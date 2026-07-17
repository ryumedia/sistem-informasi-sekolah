import CatatanAnekdotalClient from "./CatatanAnekdotalClient";

export default async function CatatanAnekdotalPage({
  params,
}: {
  params: { siswaId: string };
}) {
  const { siswaId } = await params;

  return <CatatanAnekdotalClient siswaId={siswaId} />;
}