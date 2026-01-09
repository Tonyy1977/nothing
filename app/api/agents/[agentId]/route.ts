import { NextResponse } from 'next/server';
import { AgentStore, TenantStore, verifyAgentAccess, ensureDemoSeeded } from '@/db/store';
import type { Agent } from '@/types';

export async function GET(req: Request, ctx: { params: Promise<{ agentId: string }> }) {
  ensureDemoSeeded();

  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenantId');
  const { agentId } = await ctx.params;

  if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });

  const agent = verifyAgentAccess(tenantId, agentId);
  if (!agent) return NextResponse.json({ error: 'Agent not found or access denied' }, { status: 404 });

  return NextResponse.json({ agent });
}

export async function PATCH(req: Request, ctx: { params: { agentId: string } }) {
  ensureDemoSeeded();

  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenantId');
  const { agentId } = ctx.params;

  if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });

  const agent = verifyAgentAccess(tenantId, agentId);
  if (!agent) return NextResponse.json({ error: 'Agent not found or access denied' }, { status: 404 });

  const tenant = TenantStore.getById(tenantId);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const updates = (await req.json()) as Partial<Agent>;

  // If model is being updated, enforce plan allowedModels
  const nextModel = updates.config?.model;
  if (nextModel && !tenant.settings.allowedModels.includes(nextModel)) {
    return NextResponse.json(
      { error: `Model ${nextModel} not allowed`, allowedModels: tenant.settings.allowedModels },
      { status: 403 }
    );
  }

  // If slug is being updated, enforce uniqueness per tenant
  if (updates.slug) {
    const list = AgentStore.getByTenant(tenantId);
    const taken = list.some(a => a.id !== agentId && a.slug === updates.slug);
    if (taken) return NextResponse.json({ error: 'slug already exists for tenant' }, { status: 409 });
  }

  const updated = AgentStore.update(agentId, updates);
  return NextResponse.json({ agent: updated });
}

export async function DELETE(req: Request, ctx: { params: { agentId: string } }) {
  ensureDemoSeeded();

  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenantId');
  const { agentId } = ctx.params;

  if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });

  const agent = verifyAgentAccess(tenantId, agentId);
  if (!agent) return NextResponse.json({ error: 'Agent not found or access denied' }, { status: 404 });

  AgentStore.delete(agentId);
  return NextResponse.json({ ok: true });
}
