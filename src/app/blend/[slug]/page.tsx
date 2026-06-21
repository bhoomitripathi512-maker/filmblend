import { BlendPageClient } from "@/components/BlendPageClient";

export default async function BlendPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <BlendPageClient slug={slug} />
    </div>
  );
}
