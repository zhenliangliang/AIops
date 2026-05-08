import type { DiscoverResponse, GalleryItem } from "@/lib/types";

const base = "/collected/x-gpt-image-2-prompts-2026-05-07";

export const collectedItems: GalleryItem[] = [
  {
    id: "hand-drawn-photo-edit",
    title: "Playful hand-drawn photo edit + cute cartoon transformation",
    style: "hand-drawn-photo-edit",
    styleLabel: "手绘互动 / 卡通化",
    author: "GeneratePrompt",
    handle: "@GeneratePrompt",
    prompt:
      'Analyze the uploaded image and preserve the original subject, composition, and lighting. Do not change the identity or facial structure of the main character. Add playful hand-drawn elements that directly interact with the subject in the image. The drawings should mimic, follow, or exaggerate the existing shapes, gestures, or movements--such as drawing lines around the pose, extending the arms or legs, adding motion lines, or creating fantastical elements that "interact" with the subject. Step 2: Transform the entire image into a cute cartoon illustration in a soft, vibrant, and playful cartoon style. Preserve the original scene and character details while applying a lively, cute, and fun cartoonish appearance.',
    imageUrl: `${base}/hand-drawn-photo-edit/original-1.jpg`,
    images: [
      `${base}/hand-drawn-photo-edit/original-1.jpg`,
      `${base}/hand-drawn-photo-edit/original-2.jpg`,
      `${base}/hand-drawn-photo-edit/original-3.jpg`,
      `${base}/hand-drawn-photo-edit/original-4.jpg`
    ],
    sourceUrl: "https://x.com/GeneratePrompt/status/2052345998949666833",
    createdAt: "2026-05-07 19:13",
    engine: "gpt-image-2"
  },
  {
    id: "vtuber-character-card",
    title: "VTuber character design profile card",
    style: "vtuber-character-card",
    styleLabel: "VTuber 设定卡",
    author: "Jenski Wan",
    handle: "@JenskiWan",
    prompt:
      "根據你對我的所有了解，請幫我設計一個VTuber形象，並設計成一張他的設定資料卡。不要管以往的所有形象設定",
    imageUrl: `${base}/vtuber-character-card/original-1.jpg`,
    images: [`${base}/vtuber-character-card/original-1.jpg`],
    sourceUrl: "https://x.com/JenskiWan/status/2052344123357835519",
    createdAt: "2026-05-07 19:05",
    engine: "gpt-image-2"
  },
  {
    id: "karaoke-collab-campaign",
    title: "Karaoke collaboration campaign poster",
    style: "karaoke-collab-campaign",
    styleLabel: "联名活动海报",
    author: "アユネオ",
    handle: "@Ayu_AI_0912",
    prompt:
      "この添付アイドル「●●●」のカラオケコラボキャンペーンを実施するという宣伝投稿を考えて生成してください。 右下に被写体を大きく配置して、魅力的なポージングと表情でカメラ目線。カラオケブランドは「○○○」、コラボルームのイメージ図や、コラボドリンクも載せてね。 アスペクト比を3:4にすること",
    imageUrl: `${base}/karaoke-collab-campaign/original-1.jpg`,
    images: [
      `${base}/karaoke-collab-campaign/original-1.jpg`,
      `${base}/karaoke-collab-campaign/original-2.jpg`
    ],
    sourceUrl: "https://x.com/Ayu_AI_0912/status/2052344044643385751",
    createdAt: "2026-05-07 19:05",
    engine: "gpt-image-2"
  },
  {
    id: "futuristic-streetwear-poster",
    title: "Futuristic streetwear fashion poster",
    style: "futuristic-streetwear-poster",
    styleLabel: "未来街头杂志海报",
    author: "yes&",
    handle: "@yesand_ai",
    prompt:
      'A high-end trendy streetwear fashion poster, with the main subject being a faceless futuristic model floating and leaping in the sky, wearing an oversized beige down jacket, layered hood, and knitted balaclava that completely covers the face; the lower body features white loose cargo pants, with exaggerated stacked light blue and dark blue denim leg guards folded over the pant legs, feet in beige sneakers, and a black crossbody bag on the back. The main subject is captured from an extremely low-angle upward shot perspective, with the legs and shoes dramatically enlarged for a strong visual impact, as if the figure is leaping up from directly above the viewer. The pose exudes an anti-gravity feel, with one hand extended outward, one leg kicked forward, and the overall stance dynamic, floating, and surreal. The background is a bright cyan sky with soft white clouds, under clear daylight with a strong sense of airiness. The overall design fuses high-fashion editorial photography, surreal trendy advertising, and street poster aesthetics. In the upper right and lower left corners of the image, incorporate two miniature silhouetted figure collages--one floating in the air, the other mid-jump--to evoke a fashion magazine collage vibe. The poster layout is designed as a square magazine cover, with a massive abstract rounded font at the top, reminiscent of Y2K bubble lettering and experimental street brand LOGOs; on the left side, add a small graffiti-style brand mark; on the right side, include a white handwritten brush title "RISE ABOVE WITH FASHION" with tiny editorial subtitle text below; at the bottom center, add a small barcode. The overall piece features a thin white border and subtle beige paper texture. Style keywords: futuristic street fashion, avant-garde clothing design, Y2K graphic design, magazine cover typography, collage silhouettes, ultra-low-angle upward shot, sky background, surreal floating, exaggerated perspective, trendy ad campaign, realistic fabric texture, high-definition details, clean and premium. Make the aspect ratio 9:16',
    imageUrl: `${base}/futuristic-streetwear-poster/original-1.jpg`,
    images: [`${base}/futuristic-streetwear-poster/original-1.jpg`],
    sourceUrl: "https://x.com/yesand_ai/status/2052343687539982596",
    createdAt: "2026-05-07 19:04",
    engine: "gpt-image-2"
  },
  {
    id: "anime-streetwear-graphic-poster",
    title: "Anime x streetwear x graphic poster character redesign",
    style: "anime-streetwear-graphic-poster",
    styleLabel: "动漫街头图形海报",
    author: "硅基废话",
    handle: "@DDJCXX",
    prompt:
      "创作一张来自《{franchise}》的 {character_name} 的风格化插画。\n\n角色分析：根据官方设定中的角色表现，提炼角色的核心人格原型，例如：英雄型、冷静型、神秘型、攻击型。识别原始设计中的代表性色彩，并将其作为主要视觉强调色。\n\n姿势与肢体语言：生成一个能够体现角色人格原型的标志性姿势：英雄 / 充满活力型：动态动作、宽阔站姿、爆发式运动感；冷静 / 自信型：平衡、放松的姿态，动作幅度较小；黑暗 / 神秘型：低姿态、细微动作、锐利或隐藏的目光；攻击 / 强烈型：前倾的攻击姿态、明显的身体张力、紧握拳头。\n\n面部表情：让表情精准匹配角色的个性与情绪基调。\n\n艺术风格：动漫 x 街头服饰 x 图形海报混合风格，干净线稿、半扁平化阴影、高对比度，现代、极简、视觉冲击力强。\n\n构图：竖版格式（{aspect_ratio}），主体偏离中心摆放，强烈的对角线视觉流动，通过多层次景深营造动态海报感。\n\n服装设计：将原始服装重新设计为现代街头服饰 / 机能风风格，保留角色具有辨识度的身份元素。\n\n色彩搭配：以干净的白色背景为主，使用角色代表色作为主要强调色，添加一种辅助强调色，需为互补色或类似色，保持配色极简、大胆且高对比。\n\n背景：抽象几何海报布局，有效运用留白，融入基于角色色彩主题的 subtle accents（细微点缀）。\n\n特效：能量线条、涂鸦笔触和运动强调效果，特效应符合角色的能量感与色彩身份。\n\n光照：锐利的方向性光照，清晰利落的阴影，使用角色代表色营造微妙光晕。\n\n渲染质量：超干净的矢量风格完成度，海报级构图，4K 分辨率，高细节。",
    imageUrl: `${base}/anime-streetwear-graphic-poster/original-1.jpg`,
    images: [
      `${base}/anime-streetwear-graphic-poster/original-1.jpg`,
      `${base}/anime-streetwear-graphic-poster/original-2.jpg`,
      `${base}/anime-streetwear-graphic-poster/original-3.jpg`,
      `${base}/anime-streetwear-graphic-poster/original-4.jpg`
    ],
    sourceUrl: "https://x.com/DDJCXX/status/2052342478360236373",
    createdAt: "2026-05-07 18:59",
    engine: "gpt-image-2"
  }
];

export const collectedGallery: DiscoverResponse = {
  source: "local",
  query: "GPT Image 2 prompts collected from X in the last 24 hours",
  items: collectedItems,
  message: "展示本地已下载的 X 原图和提示词，图片来自 pbs.twimg.com 原始媒体地址。"
};
