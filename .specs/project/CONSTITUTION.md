# Constituição do Projeto — My Finances

Leis imutáveis até revisão explícita deste documento. Violações são bugs.

## 1. Modelo de produto: SaaS

- O produto é oferecido como **serviço em nuvem multi-tenant**: cada conjunto de dados financeiros pertence a um **inquilino** (organização / conta de assinatura) com **isolamento obrigatório** em todas as camadas (API, consultas, jobs e armazenamento de objetos).
- Não existe acesso a dados financeiros de um inquilino por usuário autenticado de outro inquilino, exceto fluxos explícitos convidados (ex.: contador com permissão documentada no spec).
- **Segredos** (credenciais de app, chaves de API de terceiros, segredos de webhook) nunca entram em repositório; apenas cofre de segredos, variáveis de ambiente gerenciadas ou equivalente.

## 2. Privacidade, segurança e IA

- Tráfego externo com TLS; dados sensíveis em repouso com criptografia gerenciada (serviço ou BYOK quando suportado — decisão em ADR).
- Processamento por **LLM de terceiros** só com base legal/contratual clara (DPA, opção de desligar, minimização de campos enviados) **ou** com chave/provedor trazido pelo cliente (**BYOK**), conforme modo configurado no inquilino.
- Deve existir caminho para **não usar LLM em nuvem** (desligar recurso ou usar apenas processamento no edge/controlado pelo cliente quando o produto oferecer essa variante), sem quebrar o restante do fluxo de categorização manual/regras.

## 3. Arquitetura

- **Motores de domínio** (importação/parsing, parcelamento/faturas) são módulos ou serviços com fronteiras claras; a interface web e integrações consomem **API versionada** (REST ou GraphQL), não lógica interna acoplada à UI.
- Identidade (cadastro, login, sessão/token), faturação da assinatura e **quotas** são preocupações de **plataforma** de primeiro nível, não adereços posteriores.

## 4. Qualidade e rastreabilidade

- Requisitos aprovados vivem em `.specs/`; implementação verificável contra IDs de requisito ou critérios de aceite.
- Conciliação com extratos (ex.: saldo OFX vs. saldo calculado) permanece requisito de integridade nos fluxos de importação de conta corrente.

## 5. Stack

- Stack concreta (runtime, DB gerenciado, fila, storage) é decisão registrada em **ADR**. Candidatos do PRD permanecem como opções até ADR.
