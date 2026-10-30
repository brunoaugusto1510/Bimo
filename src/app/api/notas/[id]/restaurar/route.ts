import { alterarLixeira } from "@/lib/lixeira/http";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return alterarLixeira(request, (await params).id, true);
}
