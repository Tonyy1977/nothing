import { NextResponse } from 'next/server';
import { AgentStore, TenantStore, ensureDemoSeeded } from '@/db/store';
import type { Agent } from '@/types';

export async function GET(req: Request) {
  ensureDemoSeeded();

  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenantId');

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
  }

  const tenant = TenantStore.getById(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const list = AgentStore.getByTenant(tenantId);
  return NextResponse.json({ agents: list });
}

export async function POST(req: Request) {
  ensureDemoSeeded();

  const body = await req.json();
  const { tenantId, name, slug, description, config, status } = body as Partial<Agent> & {
    tenantId: string;
  };

  if (!tenantId || !name || !slug || !config?.model || !config?.systemPrompt) {
    return NextResponse.json(
      { error: 'tenantId, name, slug, config.model, config.systemPrompt are required' },
      { status: 400 }
    );
  }

  const tenant = TenantStore.getById(tenantId);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  // Plan enforcement: maxAgents
  const existingAgents = AgentStore.getByTenant(tenantId);
  if (existingAgents.length >= tenant.settings.maxAgents) {
    return NextResponse.json(
      { error: `Max agents reached for plan (${tenant.settings.maxAgents})`, upgradeRequired: true },
      { status: 403 }
    );
  }

  // Plan enforcement: allowed models
  if (!tenant.settings.allowedModels.includes(config.model)) {
    return NextResponse.json(
      { error: `Model ${config.model} not allowed`, allowedModels: tenant.settings.allowedModels },
      { status: 403 }
    );
  }

  // Slug uniqueness per tenant
  const slugTaken = existingAgents.some(a => a.slug === slug);
  if (slugTaken) {
    return NextResponse.json({ error: 'slug already exists for tenant' }, { status: 409 });
  }

  const agent: Agent = {
    id: `agent_${crypto.randomUUID().slice(0, 12)}`,
    tenantId,
    name,
    slug,
    description: description ?? '',
    config: {
      ...config,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 1024,
    },
    status: status ?? 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Agent;

  AgentStore.create(agent);
  return NextResponse.json({ agent }, { status: 201 });
}
