import { NextResponse } from "next/server";

import { assertImageInputs, generateImagesWithRightCodes, isImageModel } from "@/lib/right-codes";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是有效的 JSON。" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "请求体格式错误。" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  const size = typeof payload.size === "string" ? payload.size.trim() : "";
  const model = typeof payload.model === "string" ? payload.model : "";
  const images = Array.isArray(payload.images)
    ? payload.images.filter((item): item is string => typeof item === "string")
    : [];

  if (!prompt) {
    return NextResponse.json({ error: "提示词不能为空。" }, { status: 400 });
  }

  if (!isImageModel(model)) {
    return NextResponse.json({ error: "模型不受支持。" }, { status: 400 });
  }

  try {
    assertImageInputs(images);
    const result = await generateImagesWithRightCodes({
      prompt,
      size,
      model,
      images
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
