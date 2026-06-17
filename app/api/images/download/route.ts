import { NextResponse } from "next/server";

function sanitizeFileName(fileName: string) {
  const normalized = fileName.replace(/[^\u4e00-\u9fa5\w.-]+/g, "-").replace(/-+/g, "-");
  return normalized || "generated-image";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url")?.trim();
  const fileName = sanitizeFileName(searchParams.get("filename")?.trim() || "generated-image");

  if (!imageUrl) {
    return NextResponse.json({ error: "缺少图片地址。" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return NextResponse.json({ error: "图片地址不合法。" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: "只支持下载远程图片。" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(parsedUrl.toString(), { cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "下载源图片时网络异常。" }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: "下载源图片失败。" }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  const extension = contentType.includes("png")
    ? "png"
    : contentType.includes("jpeg") || contentType.includes("jpg")
      ? "jpg"
      : contentType.includes("webp")
        ? "webp"
        : "bin";

  return new Response(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}.${extension}"`
    }
  });
}
