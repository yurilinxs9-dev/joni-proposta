

# Usar o PDF modelo como template editavel

## Resumo
Em vez de gerar um PDF do zero, o sistema vai carregar o arquivo PDF modelo enviado como base e preencher os campos dinamicos (nome do cliente, servicos, valores, data, etc.) diretamente por cima do template original.

## O que sera feito

### 1. Salvar o PDF modelo no projeto
- Copiar o arquivo `Orcamento_MODELO_1.pdf` para a pasta `public/` do projeto
- Ele sera carregado em tempo de execucao como template base

### 2. Trocar a biblioteca de PDF
- Substituir `jsPDF` + `jspdf-autotable` por `pdf-lib`
- A biblioteca `pdf-lib` permite abrir um PDF existente e desenhar texto por cima nas coordenadas exatas
- Instalar o pacote `pdf-lib`

### 3. Reescrever `src/lib/generatePDF.ts`
- Carregar o PDF template via `fetch('/Orcamento_MODELO_1.pdf')`
- Usar `PDFDocument.load()` para abrir o documento
- Escrever os dados dinamicos nas posicoes corretas:
  - **Data**: posicao do campo "Data:" no cabecalho amarelo
  - **N Orcamento**: posicao do campo "N Orcamento:" (usar ID da proposta)
  - **Nome da empresa**: posicao do "FERIADO NACIONAL" (sera o nome do cliente/empresa)
  - **Endereco**: posicao do campo "Endereco:"
  - **Telefone**: posicao do campo "Telefone:" (WhatsApp do cliente)
  - **E-mail**: posicao do campo "E-mail:"
  - **Servicos na tabela**: preencher as linhas 01, 02, 03... com nome, descricao, valor, qty e subtotal
  - **Valores**: colunas VALOR, QTY e SUBTOTAL para cada servico
- Limpar/sobrescrever as areas de texto existentes com retangulos brancos antes de escrever os novos dados
- Salvar e fazer download do PDF final

### 4. Adicionar campo de endereco no formulario
- Adicionar campo opcional "Endereco" em `NovaProposta.tsx` nos dados do cliente
- Atualizar a interface `PDFData` para incluir `clienteEndereco`

### 5. Mapeamento de coordenadas
- Cada campo do PDF sera mapeado com coordenadas X/Y precisas para posicionar o texto corretamente
- O PDF usa formato A4 (595 x 842 pontos)
- Os textos serao escritos com a mesma fonte e tamanho visual do template original

## Secao tecnica

### Dependencias
- Adicionar: `pdf-lib` (para editar PDFs existentes)
- Remover uso de: `jspdf` e `jspdf-autotable` (podem ser mantidos no package.json caso outros recursos usem)

### Arquivos modificados
- `src/lib/generatePDF.ts` — reescrita completa para usar pdf-lib com template
- `src/pages/NovaProposta.tsx` — adicionar campo de endereco
- `src/types/proposta.ts` — campo endereco na interface (se necessario)

### Arquivos adicionados
- `public/Orcamento_MODELO_1.pdf` — template base

### Logica principal
```text
1. fetch('/Orcamento_MODELO_1.pdf')
2. PDFDocument.load(pdfBytes)
3. Obter primeira pagina
4. Desenhar retangulos brancos sobre os campos existentes
5. Escrever novos textos nas coordenadas mapeadas
6. doc.save() -> download
```

### Limitacao importante
- O numero de servicos e limitado ao espaco disponivel na tabela do template (3 linhas visiveis no modelo)
- Se houver mais de 3 servicos, sera necessario ajustar o layout ou adicionar paginas extras

