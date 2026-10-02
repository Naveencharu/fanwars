import FanWarForm from "@/components/fanwar-form";

export default async function ClanChallengePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const tribeId = /^\d+$/.test(id) ? Number(id) : NaN;
    return <FanWarForm key={id} kind="clan" tribeId={tribeId} />;
}
