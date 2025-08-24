import requests
import json
import pandas as pd
from prophet import Prophet
from openai import OpenAI
import zmail
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import os
import numpy as np
import base64
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

# 配置区
ZABBIX_URL = "https://zbx-lab.eeo-inc.com/api_jsonrpc.php"
ZABBIX_USER = "xxxxx"
ZABBIX_PASS = "xxxxx"
ITEM_KEY = "vfs.fs.size[/data1,pfree]"  # 监控项key，实际使用时请替换
THRESHOLD = 20.0  # 预警阈值（百分比）
LOOKAHEAD_MINUTES = 120  # 预测未来分钟数
OPENAI_API_KEY = "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"
ALERT_EMAIL = ["xxxxx", "xxxx"] #收件人邮箱地址
MAIL_USER = 'xxxx' #发件人邮箱地址
MAIL_PASS = 'xxxxx' #发件人邮箱密码
MAIL_SMTP = 'smtp.qq.com'
auth =  "xxxxx" #zabbix的api_key
WEWORK_WEBHOOK = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY'
MAX_WORKERS = 2  # 线程池最大并发数
PRE_WARNING_BAND = 5.0  # 预警带宽度，单位百分比

plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'Microsoft YaHei', 'sans-serif']
plt.rcParams['axes.unicode_minus'] = False

# 2. 获取所有主机的itemid和hostname

def get_all_items(auth, key_=ITEM_KEY):
    payload = {
        "jsonrpc": "2.0",
        "method": "item.get",
        "params": {
            "output": ["itemid", "name"],
            "selectHosts": ["host", "name"],
            # "hostids": "12085",
            "search": {"key_": key_}
        },
        "auth": auth,
        "id": 4
    }
    r = requests.post(ZABBIX_URL, json=payload)
    result = r.json()['result']
    itemid_host_list = []
    for item in result:
        if item['hosts']:
            host = item['hosts'][0]
            hostname = host.get('name') or host.get('host')
            itemid_host_list.append({"itemid": item['itemid'], "hostname": hostname})
    return itemid_host_list

# 3. 获取历史监控数据

def get_item_history(auth, itemid, time_from, time_till):
    payload = {
        "jsonrpc": "2.0",
        "method": "history.get",
        "params": {
            "output": "extend",
            "history": 0,  # 0: float
            "itemids": itemid,
            "sortfield": "clock",
            "sortorder": "DESC",
            "time_from": time_from,
            "time_till": time_till,
            "limit": 1000
        },
        "auth": auth,
        "id": 2
    }
    r = requests.post(ZABBIX_URL, json=payload)
    result = r.json()['result']
    print(f"[DEBUG] get_item_history for itemid={itemid}: {result[:3]} ... total={len(result)}")
    return result

# 4. 数据预处理

def preprocess(data):
    df = pd.DataFrame(data)
    df['clock'] = pd.to_numeric(df['clock'], errors='coerce')
    df['value'] = pd.to_numeric(df['value'], errors='coerce')
    df = df.dropna(subset=['clock', 'value'])
    if df.empty:
        return pd.DataFrame(columns=['ds', 'y'])
    # 先解析为UTC，再转为北京时间
    df['clock'] = pd.to_datetime(df['clock'], unit='s', utc=True)
    df['clock'] = df['clock'].dt.tz_convert('Asia/Shanghai')
    df = df.set_index('clock').sort_index()
    df = df[['value']]
    df['value'] = df['value'].astype('float64')
    df = df.resample('5min').mean().interpolate()
    df = df.reset_index()
    df = df.rename(columns={'clock': 'ds', 'value': 'y'})
    # Prophet/画图/保存csv都用 tz-naive 的北京时间
    df['ds'] = df['ds'].dt.tz_localize(None)
    return df

# 5. 用Prophet预测未来趋势

def forecast_trend(df, periods=24):
    model = Prophet()
    model.fit(df)
    future = model.make_future_dataframe(periods=periods, freq='5min')
    forecast = model.predict(future)
    return forecast[['ds', 'yhat']].tail(periods)

# 6. 判断是否超阈值

def estimate_days_to_threshold(current_value, threshold, df, window=24):
    """
    估算还需要多少天会降到阈值
    window: 取最近window个点（5min采样，24=2小时，72=6小时，288=24小时）
    """
    if df is None or len(df) < window:
        return None
    recent = df['y'].values[-window:]
    x = np.arange(len(recent))
    slope = np.polyfit(x, recent, 1)[0]  # 每5分钟的变化
    slope_per_day = slope * (60/5) * 24  # 5min采样
    if slope_per_day >= 0:
        return None  # 没有下降趋势
    days = (current_value - threshold) / abs(slope_per_day)
    if days < 0:
        return None
    return days

def should_warn(current_value, forecast, threshold, pre_warning_band=5.0, df=None):
    if current_value is None:
        return False, "无当前值"
    days = estimate_days_to_threshold(current_value, threshold, df, window=24)
    days_str = f"（按当前下降速率，预计约{days:.1f}天后达到阈值{threshold}%）" if days is not None else ""
    if threshold <= current_value <= threshold + pre_warning_band:
        return True, f"当前值{current_value:.2f}%已接近阈值{threshold}%{days_str}"
    min_future = forecast['yhat'].min()
    if current_value < threshold:
        if (forecast['yhat'].diff().mean() < 0) and (min_future < current_value):
            return True, f"当前值{current_value:.2f}%已低于阈值，且未来还会继续下降{days_str}"
    if df is not None and len(df) >= 12:
        recent = df['y'].values[-12:]
        x = np.arange(len(recent))
        slope = np.polyfit(x, recent, 1)[0]
        if slope < -0.1 and current_value < threshold + pre_warning_band:
            return True, f"最近2小时有明显下降趋势（斜率{slope:.2f}），当前值{current_value:.2f}%已接近阈值{threshold}%{days_str}"
    return False, "无需预警"

# 7. 构造AI大模型解释Prompt

def build_prompt(df, forecast, metric_name="磁盘使用率", threshold=THRESHOLD, hostname="主机"):
    history = df['y'].tolist()[-24:]
    future = forecast['yhat'].tolist()
    days = estimate_days_to_threshold(df['y'].iloc[-1], threshold, df, window=24)
    days_str = f"\n按当前下降速率，预计约{days:.1f}天后会降到阈值{threshold}%！" if days is not None else ""
    prompt = (
    f"主机：{hostname}\n"
    f"最近24小时磁盘空闲率（每5分钟采样，单位%）：\n"
    f"{history}\n"
    f"未来2小时磁盘空闲率预测：\n{future}\n"
    f"当前阈值：{threshold}%\n"
    f"磁盘空闲率越低，存储越紧张。请判断未来2小时内是否持续低于阈值，并给出预警建议。"
    f"{days_str}"
)
    return prompt

# 8. 调用OpenAI大模型

def ask_ai(prompt):
    # client = openai.OpenAI(api_key=OPENAI_API_KEY)
    # response = client.chat.completions.create(
    #     model="gpt-4o-mini",
    #     messages=[{"role": "user", "content": prompt}]
    # )
    # 使用deepseek的api
    client = OpenAI(api_key="xxxxxxx", base_url="https://api.deepseek.com")
    # 使用openai的api
    # client = OpenAI(api_key=OPENAI_API_KEY)
    messages = [{"role": "user", "content": prompt}]
    response = client.chat.completions.create(
        model="deepseek-reasoner",#deepseek-reasoner 深度思考模型
        messages=messages
    )

    reasoning_content = response.choices[0].message.reasoning_content
    content = response.choices[0].message.content

    return content

# 9. zmail 邮件告警

def plot_trend(df, hostname, itemid):
    if df.empty:
        return None
    ds_local = df['ds']
    date_str = ds_local.iloc[0].strftime('%Y-%m-%d')
    plt.figure(figsize=(10, 4))
    plt.plot(ds_local, df['y'], label='历史数据', color='blue')
    plt.xlabel('时间')
    plt.ylabel('数值(%)')
    plt.title(f'{hostname} /data1磁盘空闲率变化趋势（{date_str}）')
    plt.grid(True)
    plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
    plt.gcf().autofmt_xdate()
    plt.tight_layout()
    img_dir = "tmp_host_data"
    os.makedirs(img_dir, exist_ok=True)
    img_path = os.path.join(img_dir, f"{hostname.replace('/', '_')}_{itemid}_trend.png")
    plt.savefig(img_path)
    plt.close()
    return img_path

def send_alert_zmail(msg, hostname, img_path=None):
    server = zmail.server(MAIL_USER, MAIL_PASS, smtp_host=MAIL_SMTP)
    img_html = ''
    if img_path and os.path.exists(img_path):
        with open(img_path, 'rb') as f:
            img_data = f.read()
            img_base64 = base64.b64encode(img_data).decode('utf-8')
            img_html = f'<img src="data:image/png;base64,{img_base64}" style="max-width:700px;">'
    mail = {
        'subject': f'【智能预警】{hostname} 服务器指标异常趋势',
        'content_html': f'''
            <p>{msg.replace('\n', '<br>')}</p>
            {img_html}
        ''',
        'to': ALERT_EMAIL
    }
    server.send_mail(ALERT_EMAIL, mail)

# 10. 企业微信推送

def send_wework_alert(msg, hostname):
    content = f'【智能预警】{hostname} 服务器指标异常趋势\n{msg}'
    data = {
        "msgtype": "text",
        "text": {"content": content}
    }
    resp = requests.post(WEWORK_WEBHOOK, json=data)
    return resp.status_code == 200

def process_host(entry, auth, time_from, time_till):
    itemid = entry['itemid']
    hostname = entry['hostname']
    try:
        data = get_item_history(auth, itemid, time_from, time_till)
        if not data:
            print(f"{hostname} 未获取到监控数据")
            return {
                "hostname": hostname,
                "itemid": itemid,
                "alert": False,
                "ai_result": "未获取到监控数据",
                "latest_value": None
            }
        print(f"[DEBUG] {hostname} 原始数据样例: {data[:3]}")
        df = pd.DataFrame(data)
        print(f"[DEBUG] {hostname} DataFrame head before preprocess:\n{df.head()}")
        print(f"[DEBUG] {hostname} DataFrame dtypes before preprocess:\n{df.dtypes}")
        # 获取最新的 value
        latest_value = None
        latest_time = None
        if data:
            latest_entry = max(data, key=lambda x: int(x['clock']))
            latest_value = float(latest_entry['value'])
            latest_time = int(latest_entry['clock'])
        else:
            latest_value = None
            latest_time = None
        print(f"[DEBUG] {hostname} latest_value: {latest_value}, latest_time: {latest_time}, now: {int(time.time())}")
        df = preprocess(data)
        print(f"[DEBUG] {hostname} DataFrame after preprocess:\n{df.head()}")
        # 保存完整df到临时文件，时间转为北京时间
        if not df.empty:
            # 只用于保存临时文件，主流程 df 不变
            df_save = df.copy()
            # 判断是否 tz-aware
            if df_save['ds'].dt.tz is None:
                df_save['ds'] = df_save['ds'].dt.tz_localize('Asia/Shanghai')
            else:
                df_save['ds'] = df_save['ds'].dt.tz_convert('Asia/Shanghai')
            safe_hostname = hostname.replace('/', '_').replace(' ', '_')
            tmp_dir = "tmp_host_data"
            os.makedirs(tmp_dir, exist_ok=True)
            tmp_path = os.path.join(tmp_dir, f"{safe_hostname}_{itemid}.csv")
            df_save.to_csv(tmp_path, index=False)
            print(f"[DEBUG] {hostname} 监控数据已保存到 {tmp_path}")
        if df.empty or len(df) < 10:
            print(f"{hostname} 数据无效或过少，跳过")
            return {
                "hostname": hostname,
                "itemid": itemid,
                "alert": False,
                "ai_result": "数据无效或过少",
                "latest_value": latest_value
            }
        forecast = forecast_trend(df, periods=LOOKAHEAD_MINUTES//5)
        warn, reason = should_warn(latest_value, forecast, THRESHOLD, pre_warning_band=PRE_WARNING_BAND, df=df)
        if warn:
            prompt = build_prompt(df, forecast, metric_name="磁盘使用率", threshold=THRESHOLD, hostname=hostname)
            ai_result = ask_ai(prompt)
            # 用 matplotlib 生成趋势图
            img_path = plot_trend(df, hostname, itemid)
            send_alert_zmail(ai_result, hostname, img_path=img_path)
            print(f"{hostname} 预警已发送: {reason}")
            return {
                "hostname": hostname,
                "itemid": itemid,
                "alert": True,
                "ai_result": ai_result,
                "latest_value": latest_value
            }
        else:
            print(f"{hostname} 指标正常，无需预警。原因：{reason}")
            return {
                "hostname": hostname,
                "itemid": itemid,
                "alert": False,
                "ai_result": "正常",
                "latest_value": latest_value
            }
    except Exception as e:
        print(f"{hostname} 处理异常: {e}")
        return {
            "hostname": hostname,
            "itemid": itemid,
            "alert": False,
            "ai_result": f"处理异常: {e}",
            "latest_value": None
        }

def batch_predict(itemid_host_list):
    results = []
    now = int(time.time())
    time_from = now - 6*3600
    time_till = now
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_entry = {
            executor.submit(process_host, entry, auth, time_from, time_till): entry
            for entry in itemid_host_list
        }
        for future in as_completed(future_to_entry):
            result = future.result()
            results.append(result)
    df_result = pd.DataFrame(results)
    df_result.to_csv("batch_predict_result.csv", index=False)
    print("批量预测完成，结果已保存到 batch_predict_result.csv")

if __name__ == "__main__":
    itemid_host_list = get_all_items(auth, key_=ITEM_KEY)
    batch_predict(itemid_host_list) 