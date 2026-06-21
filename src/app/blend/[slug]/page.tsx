import { BlendPageClient } from "@/components/BlendPageClient";

export default async function BlendPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <BlendPageClient slug={slug} />;
}
