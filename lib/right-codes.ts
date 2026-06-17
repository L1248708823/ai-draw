export const imageModels = [
  {
    id: "gpt-image-2-vip",
    name: "gpt-image-2-vip",
    description: "OpenAI 最新画图模型，官方直连，支持分辨率：1K、2K、4K"
  },
  {
    id: "gpt-image-2",
    name: "gpt-image-2",
    description: "OpenAI 最新画图模型，特价版，支持分辨率：1K"
  },
  {
    id: "nano-banana",
    name: "nano-banana",
    description: "由 gemini-2.5-flash-image 模型封装而来"
  },
  {
    id: "nano-banana-2",
    name: "nano-banana-2",
    description: "nano banana 第二代绘图模型，综合效果远超上一代，支持分辨率：1K、2K、4K"
  },
  {
    id: "nano-banana-pro",
    name: "nano-banana-pro",
    description: "nano banana 第二代绘图模型，综合效果远超上一代，支持分辨率：1K、2K、4K"
  }
] as const;

export type ImageModel = (typeof imageModels)[number]["id"];

export type GenerateImagesRequest = {
  prompt: string;
  size: string;
  model: ImageModel;
  images: string[];
};

export type GenerateImagesResponse = {
  createdAt: string;
  images: string[];
};

type RightCodesGenerationResponse = {
  created?: number;
  data?: Array<{
    url?: string;
  }>;
};

export function isImageModel(value: string): value is ImageModel {
  return imageModels.some((item) => item.id === value);
}

export async function generateImagesWithRightCodes({
  prompt,
  size,
  model,
  images
}: GenerateImagesRequest): Promise<GenerateImagesResponse> {
  const apiKey = process.env.RIGHT_CODES_API_KEY?.trim();
  const baseUrl = process.env.RIGHT_CODES_BASE_URL?.trim() || "https://www.right.codes/draw";

  if (!apiKey) {
    throw new Error("缺少 RIGHT_CODES_API_KEY，请先在 .env.local 中配置。");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model.trim() || process.env.RIGHT_CODES_IMAGE_MODEL?.trim() || "gpt-image-2-vip",
      prompt,
      image: images,
      ...(size.trim() ? { size: size.trim() } : {}),
      response_format: "url"
    }),
    cache: "no-store"
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Right Codes 生图失败，HTTP ${response.status}：${responseText}`);
  }

  let payload: RightCodesGenerationResponse;
  try {
    payload = JSON.parse(responseText) as RightCodesGenerationResponse;
  } catch {
    throw new Error("Right Codes 返回了无法解析的内容。");
  }

  if (!Array.isArray(payload.data) || payload.data.length === 0) {
    throw new Error("Right Codes 返回缺少图片数据。");
  }

  const urls = payload.data
    .map((item) => item.url?.trim())
    .filter((value): value is string => Boolean(value));

  if (urls.length === 0) {
    throw new Error("Right Codes 返回缺少可用图片地址。");
  }

  return {
    createdAt: new Date((payload.created ?? Date.now() / 1000) * 1000).toISOString(),
    images: urls
  };
}

export function assertImageInputs(images: string[]) {
  if (!Array.isArray(images)) {
    throw new Error("参考图字段格式不正确。");
  }

  for (const item of images) {
    if (!item.startsWith("data:image/") && !item.startsWith("https://") && !item.startsWith("http://")) {
      throw new Error("参考图格式不受支持。");
    }
  }
}
