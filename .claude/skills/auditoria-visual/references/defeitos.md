# Catálogo de defeitos visuais

Leia antes de olhar as fotos. Saber o que procurar muda o que você enxerga: sem uma
lista, o olho aceita quase tudo; com ela, o defeito salta.

Cada item traz o sintoma na imagem, a causa que costuma estar por trás e o conserto.

## Montagem de peças

**Peça flutuando ou frouxa** — barras que não se tocam, telhado descolado da parede,
assento pendurado no nada.
Causa: posição e rotação calculadas de cabeça, uma peça de cada vez, sem ninguém
garantir que os pontos coincidem.
Conserto: construa ligando dois pontos em vez de girar por tentativa. Uma barra entre
`de` e `para` (`quaternion.setFromUnitVectors(new Vector3(0,1,0), direção)`) encaixa
exatamente, e continua encaixando se você mudar as medidas depois.

**Membro engolido pelo corpo** — de costas o personagem é uma bola; os braços existem
no código mas estão dentro da esfera do tronco.
Causa: o pivô do braço foi posto em `raio * 0.9`, que é *dentro* da superfície.
Conserto: pivô fora do raio (`raio * 1.05+`) e abertura suficiente para o membro
cruzar a silhueta. Confira sempre por uma foto de costas, não só de frente.

**Peças se atravessando** — arbusto dentro do assento, personagem dentro da parede.
Causa: posicionamento aleatório sem raio mínimo entre objetos.
Conserto: separe as faixas de distância de cada tipo de objeto, ou mantenha uma área
livre em volta do que precisa ser visto.

**Objeto afundado ou flutuando sobre o terreno** — pés enterrados, casa levitando.
Causa: usou a altura do centro do terreno em vez da altura na posição do objeto.
Conserto: uma função `alturaDaSuperficie(x, z)` usada por todo mundo que se apoia.

## Enquadramento e leitura

**Silhueta ilegível** — a peça só é reconhecível de um ângulo; de outro vira um poste.
Causa: forma modelada olhando uma vista só.
Conserto: dê volume nas duas direções (uma estrutura em "A" precisa abrir nos dois
eixos) e sempre fotografe de frente **e** de lado.

**Detalhe pequeno demais para ler** — textura de telhado que some, escrita ilegível.
Causa: `repeat` da textura em unidades de mundo mal calibrado, ou detalhe modelado na
escala errada para a distância em que é visto.
Conserto: calibre pela distância real de jogo, não pelo close.

**Proporção errada entre coisas** — barco maior que a ilha, personagem do tamanho da
porta.
Causa: cada peça foi feita com sua própria noção de escala.
Conserto: escolha uma medida-âncora (a altura de um personagem adulto, por exemplo) e
derive as outras dela. Compare com a referência: quantos personagens cabem na largura
da casa?

## Cenário e fundo

**Canto do plano aparecendo no céu** — um triângulo claro estranho no horizonte.
Causa: o plano do chão/água é quadrado; os cantos ficam mais longe que as bordas e
ultrapassam o alcance da névoa ou do degradê.
Conserto: plano bem maior que o alcance da névoa, com o degradê terminando antes da
borda — ou geometria radial.

**Faixa escura na linha d'água** — a onda baixa e descobre a base do terreno.
Causa: a cor da base submersa é diferente da grama e a superfície da água oscila.
Conserto: pinte a faixa logo abaixo da linha d'água com a cor de cima.

**Banding / degradê facetado no céu** — o céu mostra triângulos.
Causa: esfera do céu com poucos segmentos.
Conserto: mais segmentos, ou calcular o degradê por direção normalizada.

**Z-fighting** — duas superfícies piscando/rasgando onde se encostam.
Causa: dois planos exatamente na mesma altura.
Conserto: separe alguns milésimos, ou use `polygonOffset`.

**Superfície de dentro aparecendo** — buraco por onde se vê o interior do objeto.
Causa: geometria aberta com material `FrontSide`.
Conserto: feche a geometria (um anel de acabamento na borda resolve e ainda dá o
contorno branco típico de casco de barco) ou use `DoubleSide`.

## Interface sobre a cena

**Um painel cobre o outro** — só acontece num tamanho de tela específico.
Causa: media query escrita por largura, quando o problema é a altura (celular
deitado é largo e baixo).
Conserto: `@media (max-height: ...)` para o caso deitado; e rode `ui-overlap.mjs` em
vários tamanhos, porque isso não aparece na resolução em que você está trabalhando.

**Texto ilegível sobre a cena** — some no fundo claro ou no escuro.
Causa: cor de texto escolhida contra um fundo só.
Conserto: sombra de texto nos dois sentidos, ou uma caixa translúcida. Confira contra
a região mais clara e a mais escura da cena.

**Controle de toque invisível ou intocável** — aparece no lugar errado, ou não
aparece nunca no aparelho certo.
Causa: visibilidade decidida por largura de tela em vez de capacidade de toque.
Conserto: `matchMedia('(hover: none)')`, e teste em um contexto com `hasTouch`.

## Animação

**Peça animada que descola do resto** — a parte que mexe sai do lugar de encaixe.
Causa: a animação gira o objeto inteiro em vez de um pivô no ponto de articulação.
Conserto: um `Group` vazio no ponto de giro, com a peça pendurada nele.

**Efeito exagerado** — espuma, partículas ou brilho que dominam a cena.
Causa: escala e tempo de vida chutados.
Conserto: reduza até quase sumir e volte um pouco; efeito bom é o que só se nota
quando falta.
