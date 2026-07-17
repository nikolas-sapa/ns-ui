import { notFound } from "next/navigation";
import { demos } from "@/registry/index";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const Demo = demos[name];
  if (!Demo) notFound();
  return (
    <div className="min-h-screen">
      <Demo />
    </div>
  );
}
