# ADR-0007: Modelo de domínio — workspaces, contas e transferências (M1)

## Status

Proposto — 2026-04-15 (Plan M1)

## Contexto

M1 introduz isolamento lógico **por workspace** dentro da organização, contas com saldo inicial e transferências intra e inter-workspace (PF ↔ PJ). É necessário persistir dados com integridade referencial a `Organization`, garantir quotas (`maxWorkspaces`) e definir como **saldo atual** e **concorrência** se comportam antes da importação OFX (M3).

## Decisão

### 1. Entidades Prisma (nomes orientativos)

- **`Workspace`**: `id`, `organizationId` (FK), `kind` (`personal` \| `business`), `name`, `archivedAt` (nullable — soft archive), timestamps.
- **`Account`**: `id`, `organizationId`, `workspaceId` (FK), `name`, `type` (`checking` \| `investment`), `currency` (string ISO, default `BRL`), `initialBalance` (Decimal), `archivedAt` (nullable), timestamps.
- **`Transfer`**: `id`, `organizationId`, `fromAccountId`, `toAccountId`, `amount` (Decimal > 0), `currency` (deve igualar contas), `bookedAt` (DateTime), `memo` (nullable), `createdAt`.

**Regra de integridade (aplicação + DB):** `fromAccountId` ≠ `toAccountId`; ambas contas com `archivedAt` null; mesma `currency`; `organizationId` da transferência igual à das duas contas.

### 2. Arquivamento

- **Workspace arquivado:** não permite criar **novas contas** nem **novas transferências** com qualquer conta pertencente a esse workspace. Leituras (lista de workspaces, contas, histórico) permanecem permitidas para transparência.
- **Conta arquivada:** não participa de novas transferências; leitura e saldo derivado ainda podem ser exibidos para histórico.

### 3. Saldo atual

- **Derivado**, não materializado: `initialBalance + Σ(entradas) − Σ(saídas)` onde transferências definem débito na origem e crédito no destino na mesma moeda.
- Exposto na API em `GET` de conta (campo calculado, ex.: `currentBalance`) via agregação SQL ou subconsulta na mesma transação de leitura opcional.

### 4. Concorrência em transferências

A criação de `Transfer` **precisa** ocorrer dentro de `prisma.$transaction`. A escolha é determinística e escalonada em dois modos:

1. **Modo primário — Serializable:** usar `prisma.$transaction(fn, { isolationLevel: 'Serializable' })`. O Prisma retorna `P2034` (*Transaction conflict / serialization failure*) quando o Postgres aborta por conflito; o serviço deve **retry automático** até 3 vezes com backoff curto (ex.: 20/50/120 ms) antes de propagar o erro ao handler.
2. **Fallback — advisory locking explícito:** caso a execução comprove inviabilidade do modo Serializable em produção (ex.: driver/pool não suportando `SERIALIZABLE`, *thrash* por conflito constante, ou cenário multi-região documentado em ADR futuro), substituir por `READ COMMITTED` + `SELECT … FOR UPDATE` nas duas contas envolvidas dentro da mesma transação, ordenando o lock por `accountId` ASC para evitar deadlocks simétricos.

**Regras comuns aos dois modos:**

- Carregar `from` e `to` dentro da transação, validar `organizationId` igual, `archivedAt IS NULL` em ambas, moeda idêntica, `amount > 0` e `fromAccountId ≠ toAccountId` antes de inserir.
- Jamais confiar em `organizationId` vindo do body — derivar das contas carregadas.
- Registrar `Transfer` e `AuditLog` na **mesma** transação (auditoria atômica para M1-CA-06).

A **primeira implementação** (M1-I-005) usa o modo primário (Serializable + retry). Adoção do fallback exige nota/ADR incremental citando o cenário observado.

### 5. Transferência inter-workspace

- Permitida apenas quando os workspaces das duas contas são distintos **e** o par de `kind` é exatamente `personal` ↔ `business` (ordem irrelevante). Outras combinações → **422** com código estável (`transfer_workspace_kind_not_allowed`).

### 6. Onboarding

- No **registro** que hoje cria `Organization` + `Subscription` + owner, criar **automaticamente** um workspace `personal` default (nome configurável, ex. "Pessoal") na mesma transação. Garante que sempre existe contexto financeiro mínimo e alinha seed/testes.

## Consequências

**Positivas:** modelo simples; sem drift de saldo materializado; regras PF↔PJ explícitas; arquivo preserva auditoria.

**Negativas:** agregação de saldo pode custar O(n) transferências — aceitável até volume que exija snapshot/materialização (ADR futuro).

**Alternativas rejeitadas:** saldo em coluna atualizada por triggers (complexidade e testes); RLS nesta fase (permanece opção em ADR-0001).
