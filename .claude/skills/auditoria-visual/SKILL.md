---
name: auditoria-visual
description: Auditoria visual de interface, jogo ou cena 3D que roda no navegador — fotografa a tela elemento por elemento com Playwright, compara cada peça com a estética de referência e lista defeitos concretos antes de corrigir. Use sempre que pedirem para avaliar, revisar, melhorar ou "aproximar da referência" o visual de algo que aparece na tela; quando reclamarem que alguma peça está "mal feita", "feia", "torta" ou "quebrada"; quando mandarem um print apontando um problema; e também depois de você mexer em qualquer coisa visível (HUD, CSS, modelo 3D, shader, layout responsivo), para conferir o resultado antes de dizer que está pronto. Vale mesmo quando o pedido não usa a palavra "auditoria" — visual audit, screenshot review, "deixa parecido com X".
---

# Auditoria visual

## O erro que esta skill existe para evitar

O modo natural de "avaliar o visual" é ler o código, achar que faz sentido e declarar
que está bom. Isso não funciona: o código do balanço de um parquinho pode estar
perfeitamente coerente — quatro cilindros amarelos, uma barra, um assento — e o
resultado na tela ser um punhado de varetas soltas que não se tocam. Nenhuma leitura
de código revela isso. **Só a imagem revela.**

Então a regra que organiza tudo aqui é: *você não auditou o que você não viu*. Cada
afirmação sobre o visual precisa vir de uma foto que você olhou.

E uma foto da tela inteira não basta. De longe, tudo parece aceitável — os defeitos
somem em 40 pixels. O que faz a auditoria funcionar é **uma foto por elemento, de
perto**, como se você fosse fotografar cada peça de um brinquedo separadamente.

## Fluxo

1. Prepare o alvo (servidor de pé + jeito de mover a câmera)
2. Fotografe cada elemento de perto, antes de mudar qualquer coisa
3. Olhe cada foto e escreva o defeito em uma frase verificável
4. Corrija e refotografe com o mesmo enquadramento
5. Rode a regressão funcional e só então relate

### 1. Prepare o alvo

Sirva a página (`npm start`, `python -m http.server`, o que o projeto usar) e confirme
com `curl -s -o /dev/null -w "%{http_code}" http://localhost:PORTA`.

Para cenas 3D você precisa **posicionar a câmera em qualquer objeto**.

Em three.js isso sai de graça: ligue `"three": true` no config e o `shoot.mjs` injeta
`assets/auditoria-3d.js` antes dos scripts da página. O three.js avisa
`window.__THREE_DEVTOOLS__` quando cria a cena e o renderer, então o ajudante pega os
dois **sem alterar uma linha do projeto auditado**. Ele ainda troca a câmera na hora
de desenhar, em vez de mover a do app — o que faz o enquadramento sobreviver a jogos
com câmera controlada, que sobrescreveriam a posição no quadro seguinte.

Em qualquer outro motor (ou quando você precisa mexer no estado do app, como trocar
de fase antes da foto), o caminho é um handle de depuração — uma linha no arquivo
principal:

```js
// Acesso ao estado pelo console do navegador (útil para depurar e testar).
window.meuApp = { get cena() { return cena; }, camera, controles, jogador };
```

Isso não é gambiarra de teste: é a diferença entre conseguir ou não olhar as peças.
Deixe no código, comentado como ferramenta de depuração.

Três coisas que fazem a foto valer mais:

- **Esconda a interface** (`document.getElementById('hud').style.display = 'none'`)
  antes de fotografar o cenário, senão painel e botões cobrem justamente o que você
  quer ver.
- **Cena determinística.** Se o mundo é gerado com `Math.random()`, troque por um
  gerador com semente. Sem isso, o "depois" muda de assunto e a comparação não vale.
- **Espere alguns segundos** depois de carregar: shaders compilam, texturas chegam,
  animações partem de um estado inicial errado.

### 2. Fotografe cada elemento de perto

Use `scripts/shoot.mjs` (veja "Scripts" abaixo). Uma foto por elemento, enquadrando
a peça de modo que ela ocupe boa parte do quadro.

Faça a lista de elementos a partir do que o projeto realmente constrói — varra os
módulos atrás de funções `create*`/`make*`, ou os componentes da interface. Cada uma
delas é um elemento a fotografar. Não julgue por amostragem: o defeito costuma estar
justamente na peça que você acharia sem graça olhar.

Fotografe cada peça de **dois ângulos** quando a forma importa (frente e lado). Muita
coisa parece certa de um ângulo e desmonta do outro: uma estrutura em "A" vista de
frente é só um poste.

### 3. Olhe e escreva o defeito

Para cada foto, compare com a referência e escreva **uma frase que alguém possa
conferir na imagem**. Compare quatro coisas, nesta ordem — a silhueta é a que mais
denuncia:

| O quê | Pergunta |
| --- | --- |
| Silhueta | Dá para reconhecer o objeto só pelo contorno preto? Ele lê como a coisa que deveria ser? |
| Encaixe | As partes se tocam? Alguma flutua, atravessa outra ou some dentro de outra? |
| Proporção | O tamanho relativo bate com a referência (personagem × porta, barco × ilha)? |
| Cor e acabamento | Paleta, contraste e nível de detalhe combinam com o resto da cena? |

Escreva assim:

- ✅ "As pernas do balanço não encostam na barra; a barra flutua 20 cm acima."
- ✅ "Os braços do personagem ficam dentro da esfera do corpo — de costas ele é uma bola."
- ❌ "O balanço precisa melhorar." (não dá para conferir nem para saber quando acabou)

Se uma peça está boa, **diga que está boa e não mexa**. Auditoria que reescreve tudo
perde a confiança de quem lê o relatório — e costuma piorar o que estava certo.

`references/defeitos.md` tem o catálogo dos defeitos que mais aparecem (peça flutuando,
membro engolido, canto do plano aparecendo no céu, textura pequena demais para ler,
z-fighting). Leia antes de olhar as fotos: saber o que procurar muda o que você enxerga.

### 4. Corrija e refotografe

Uma correção por vez, e **refotografe com exatamente o mesmo enquadramento** — o
mesmo arquivo de configuração, mudando só o rótulo (`--label antes` / `--label depois`).
Sem enquadramento idêntico, "melhorou" vira opinião.

Se a correção não melhorou a foto, ela não é uma correção. Desfaça em vez de empilhar.

Ao construir formas geométricas, prefira **ligar dois pontos** a acertar ângulos por
tentativa. A causa mais comum de "peça torta" é uma cadeia de `rotation` + `position`
calculada de cabeça. Um utilitário que cria uma barra entre `de` e `para` (com
`quaternion.setFromUnitVectors`) faz as peças se encontrarem exatamente, de qualquer
ângulo.

### 5. Regressão e relato

Mexer no visual quebra coisa invisível: colisão que dependia do raio, altura de
posicionamento, teste que procurava um elemento. Rode os testes funcionais do projeto
depois da rodada visual.

No relato, para cada elemento: o que estava errado, o que virou, e o que você olhou e
decidiu não mexer. Se der, mande as imagens antes/depois — é o que deixa a conversa
objetiva.

## Scripts

Precisam de `npm i playwright`. Em ambiente headless, WebGL só funciona com os flags
de software rendering, que os scripts já passam.

### `scripts/shoot.mjs` — fotos por elemento

```bash
node scripts/shoot.mjs config.json --label antes --out ./fotos
```

O `config.json` descreve o alvo e a lista de fotos:

```json
{
  "url": "http://localhost:5173/",
  "viewport": { "width": 1000, "height": 640 },
  "prepare": [
    { "click": "#start-button" },
    { "wait": 800 },
    { "hide": ["#hud", "#buttons", "#minimap"] }
  ],
  "shots": [
    {
      "name": "balanco",
      "eval": "const { jogo, camera, controles } = window.meuApp; const alvo = jogo.ilhas[2].userData.swing; const p = alvo.getWorldPosition(new camera.position.constructor()); controles.target.set(p.x, p.y + 1, p.z); camera.position.set(p.x + 6, p.y + 2.5, p.z + 6); controles.update();",
      "wait": 700
    },
    { "name": "menu", "selector": "#painel", "wait": 300 }
  ]
}
```

Cada foto aceita `frame` (enquadramento automático em three.js), `eval` (código rodado
na página — para mover a câmera de outros motores ou preparar o estado), `selector`
(recorta o elemento do DOM), `viewport` (sobrescreve o global, útil para testar celular
deitado) e `wait`. O script imprime os erros de console ao final: erro de shader e
exceção aparecem aqui e explicam muita coisa esquisita.

#### Modo three.js, sem tocar no projeto

Com `"three": true` no config, primeiro descubra o que existe na cena:

```bash
node scripts/shoot.mjs config.json --label mapa --out /tmp/fotos
# dentro da página: window.__auditoria.listar({ profundidade: 3 })
```

`listar()` devolve a árvore com um **endereço** por objeto (`"33/4"` = quinto filho do
34º objeto da cena) — útil justamente porque a maioria dos projetos não dá nome aos
objetos. Se o projeto nomeia (`objeto.name = 'macieira'`), o nome também serve.

Aí cada foto vira uma linha:

```json
{ "name": "macieira", "frame": { "objeto": "33/4", "angulo": 0.4 }, "wait": 700 }
```

`frame` aceita `objeto` (endereço ou nome), `distancia`, `altura` (ambos `"auto"` por
padrão, derivados do tamanho da peça) e `angulo` em radianos — repita a mesma foto com
`angulo` diferente para ver a peça de outro lado. Dar nome aos objetos no projeto
(`grupo.name = 'balanço'`) deixa a auditoria muito mais legível e é um bom hábito de
qualquer forma.

### `scripts/ui-overlap.mjs` — sobreposição de interface

```bash
node scripts/ui-overlap.mjs http://localhost:5173 "#hud,#buttons,#minimap,#touch" \
  --viewport 900x414 --viewport 412x915
```

Compara as caixas dos elementos e lista os pares que se cruzam, em cada tamanho de
tela. É como se descobre que o mapa cobre o botão em celular deitado — a olho, em
uma resolução só, isso passa batido.

## Quando não usar

Se o pedido é sobre lógica, desempenho ou dados, e não sobre o que aparece na tela,
esta skill não ajuda. E se não houver como rodar a página (sem servidor, sem browser),
diga isso em vez de opinar sobre o visual a partir do código — um palpite apresentado
como avaliação é pior do que admitir que não deu para olhar.
