# PRD: Sistema de Gestão Financeira Pessoal e Empresarial

## 1. Visão Geral do Produto
Um sistema de gestão financeira "privacy-first" focado na consolidação de múltiplas fontes de dados bancários (via arquivos estáticos) e na gestão unificada de múltiplos perfis (Pessoa Física e entidades de Pessoa Jurídica). O objetivo principal é eliminar o trabalho manual de data-entry, automatizar o rastreamento complexo de faturas de cartão de crédito (incluindo projeção de parcelas) e gerar insights acionáveis sobre o fluxo de caixa.

## 2. Objetivos e Métricas de Sucesso
* **Tempo de Conciliação:** Reduzir o tempo gasto com fechamento mensal para menos de 15 minutos por entidade (PF/PJ).
* **Precisão de Categorização:** Atingir >90% de acerto na auto-categorização de transações importadas.
* **Visibilidade Futura:** Projetar fluxo de caixa (contas a pagar + faturas futuras de cartões) com pelo menos 3 meses de antecedência.

## 3. Escopo de Funcionalidades (Requisitos Funcionais)

### 3.1. Gestão de Contas (PF e PJ)
* **Múltiplos Perfis (Workspaces):** Separação lógica total entre finanças pessoais e operações empresariais (ex: transações da sua LTDA ou da operação agro não devem se misturar com o orçamento doméstico, a menos que numa visão consolidada de "Distribuição de Lucros").
* **Contas Correntes e Investimentos:** Cadastro de múltiplas contas institucionais, suportando saldo inicial e saldo consolidado.
* **Transferências Internas:** Capacidade de espelhar transferências entre contas do mesmo perfil ou entre PF e PJ (ex: pró-labore, reembolso).

### 3.2. Controle de Cartões de Crédito (O Motor de Faturas)
* **Cadastro de Múltiplos Cartões:** Associação de cada cartão a um perfil (PF/PJ), com definição de Limite Total, Limite Disponível, Dia de Fechamento e Dia de Vencimento.
* **Gestão de Faturas (Ciclos):** Abertura e fechamento automático de faturas baseados nas datas de corte.
* **Motor de Parcelamentos:**
    * Lançamentos parcelados devem gerar "transações filhas" automaticamente projetadas para as faturas futuras subsequentes (ex: `1/12`, `2/12`).
    * Suporte para antecipação de parcelas e recálculo de limite.
* **Estornos e Cashbacks:** Tratamento de créditos na fatura que abatem o saldo devedor ou anulam transações específicas.

### 3.3. Motor de Importação (OFX e CSV)
* **Upload e Parsing:** Interface para upload em lote de arquivos `.ofx` (para extratos de conta corrente) e `.csv` (para faturas de cartão).
* **Mapeamento de Colunas CSV:** Como cada banco exporta a fatura do cartão em um formato CSV diferente, o sistema deve permitir salvar "templates de importação" (ex: "Template Nubank", "Template Itaú").
* **Deduplicação Inteligente:** Hash ou identificador único para evitar a criação de transações duplicadas caso o mesmo arquivo (ou janelas de datas sobrepostas) seja importado duas vezes.

### 3.4. Categorização e Enriquecimento de Dados
* **Categorias e Tags:** Estrutura hierárquica (Categoria Pai > Subcategoria) e sistema flexível de tags (ex: `#viagem_sp`, `#manutencao_servidor`).
* **Motor de Regras (If/Then):** Regras fixas baseadas no descritivo do banco (ex: `Se descrição contém "UBER", categoria = Transporte`).
* **Categorização Assistida por IA (LLM):** Envio periódico de transações não categorizadas para uma API de LLM (como o Gemini) ou um modelo local, processando o array de descrições e retornando a categoria mais provável em JSON.

### 3.5. Dashboard e Insights
* **Visão Geral (Visão de Hoje):** Saldo consolidado das contas, faturas abertas e contas a vencer nos próximos 7 dias.
* **Análise de Gastos (Drill-down):** Gráficos de pizza/barras de despesas por categoria e subcategoria, com filtro de competência (data da compra) vs. caixa (data do pagamento da fatura).
* **Anomalias e Alertas:** Destacar categorias que ultrapassaram o orçamento mensal estipulado ou assinaturas recorrentes que sofreram aumento de valor.

### 3.6. Motor de Conciliação e Auditoria (Reconciliation Engine)
* **Verificação de Saldo:** O sistema deve cruzar o "Saldo Calculado" (soma das transações no banco de dados) com o "Saldo Real" informado no cabeçalho do arquivo OFX. 
* **Identificação de Furos:** Se houver divergência, o sistema deve alertar que há transações perdidas ou não importadas, garantindo a integridade dos dados ao longo dos meses.

### 3.7. Gestão de Comprovantes e Notas Fiscais (Anexos)
* **Vinculação de Documentos:** Capacidade de anexar arquivos (PDFs de notas fiscais, fotos de recibos) diretamente às transações.
* **Contexto PJ:** Considerando a gestão de entidades PJ (como uma operação de holding, LTDA ou atividades agro), a contabilidade exige a guarda dos comprovantes atrelados às saídas de caixa.

### 3.8. Exportação para Contabilidade (Módulo Contador)
* **Fechamento Mensal:** Geração de pacotes de exportação padronizados (PDF com razão, planilhas consolidadas ou arquivos remessa) filtrados apenas pelo "Workspace PJ", prontos para serem enviados ao contador no final do mês.
* **Acesso de Leitura (Opcional):** Criação de um perfil "Read-Only" para o contador acessar o dashboard PJ e baixar os relatórios de forma independente.

## 4. Requisitos Não Funcionais

* **Privacidade e Segurança:** Como lidará com dados sensíveis de negócios e pessoais, o banco de dados deve rodar localmente ou em uma infraestrutura privada controlada por você. Senhas ou chaves de API (para categorização IA) devem ser encriptadas via variáveis de ambiente.
* **Arquitetura:** Recomenda-se uma abordagem modular. O "Motor de Importação/Parsing" e o "Motor de Parcelamento" devem ser serviços (ou módulos de domínio) completamente desacoplados da interface.
* **Stack Tecnológico Sugerido:**
    * *Backend:* Node.js ou Java (Spring Boot) lidando com a lógica de negócios e o parsing pesado de OFX/CSV.
    * *Banco de Dados:* PostgreSQL (excelente para queries analíticas do dashboard e JSONB para metadados de transações).

### 4.1. Privacidade Absoluta com LLMs Locais (Refinamento Não-Funcional)
* **Categorização On-Premises:** Para garantir que nenhum dado financeiro vaze ou seja usado para treinar modelos de terceiros, a funcionalidade de categorização por IA pode ser desenhada para consumir LLMs rodando diretamente no seu hardware local (via **Ollama** ou **LM Studio**). O sistema envia o array de descrições para o endpoint `localhost` e recebe o JSON de volta, mantendo tudo 100% isolado da internet.

### 4.2. API First e Webhooks (Preparação para o Futuro)
* **Extensibilidade:** O backend deve expor rotas REST/GraphQL para que, no futuro, outras automações (como um script de automação lendo e-mails ou um ERP) possam injetar despesas diretamente via API sem precisar de upload manual de arquivo.
