/**
 * Ajudante de enquadramento para cenas three.js — injetado ANTES dos scripts da
 * página, sem precisar de nenhuma alteração no projeto auditado.
 *
 * O truque: o three.js avisa `window.__THREE_DEVTOOLS__` toda vez que cria uma
 * Scene ou um WebGLRenderer (é assim que a extensão de devtools funciona). Se
 * esse objeto já existir quando a página carregar, ele cai no nosso colo.
 *
 * Depois disso, em vez de mover a câmera do app — que o laço de animação
 * sobrescreveria no quadro seguinte — trocamos a câmera na hora de desenhar.
 * Assim o enquadramento vale mesmo em jogo com câmera controlada.
 *
 * API dentro da página:
 *   __auditoria.listar()                      → árvore da cena, com endereços
 *   __auditoria.enquadrar('0/3/2', { ... })   → aponta para o objeto
 *   __auditoria.enquadrar('macieira')         → também aceita nome
 *   __auditoria.soltar()                      → devolve a câmera ao app
 */
(() => {
  const observados = [];
  window.__THREE_DEVTOOLS__ = {
    dispatchEvent(evento) {
      if (evento?.detail) observados.push(evento.detail);
    },
    addEventListener() {},
    removeEventListener() {},
  };

  const auditoria = {
    _override: null,
    _cameraApp: null,

    get cena() {
      return observados.find((o) => o?.isScene) ?? null;
    },

    get renderer() {
      return observados.find((o) => o?.domElement && typeof o.render === 'function') ?? null;
    },

    /** Intercepta o render para saber qual câmera o app usa e poder trocá-la. */
    _prender() {
      const renderer = this.renderer;
      if (!renderer || renderer.__auditoriaPresa) return renderer;
      const original = renderer.render.bind(renderer);
      const self = this;
      renderer.render = function (cena, camera) {
        self._cameraApp = camera;
        return original(cena, self._override ?? camera);
      };
      renderer.__auditoriaPresa = true;
      return renderer;
    },

    /** Endereço de um objeto: índices dos filhos, tipo "0/3/2". */
    listar({ profundidade = 3, limite = 400 } = {}) {
      const cena = this.cena;
      if (!cena) return { erro: 'nenhuma cena three.js encontrada' };
      const linhas = [];
      const andar = (objeto, caminho, nivel) => {
        if (linhas.length >= limite) return;
        if (caminho) {
          linhas.push({
            endereco: caminho,
            nome: objeto.name || '',
            tipo: objeto.type,
            filhos: objeto.children.length,
            visivel: objeto.visible,
          });
        }
        if (nivel >= profundidade) return;
        objeto.children.forEach((filho, i) =>
          andar(filho, caminho === '' ? String(i) : `${caminho}/${i}`, nivel + 1)
        );
      };
      andar(cena, '', 0);
      return linhas;
    },

    achar(alvo) {
      const cena = this.cena;
      if (!cena) return null;
      if (typeof alvo === 'object') return alvo;
      const texto = String(alvo);
      if (/^\d+(\/\d+)*$/.test(texto)) {
        let atual = cena;
        for (const parte of texto.split('/')) {
          atual = atual?.children?.[Number(parte)];
          if (!atual) return null;
        }
        return atual;
      }
      return (
        cena.getObjectByName(texto) ??
        (() => {
          let achado = null;
          cena.traverse((o) => {
            if (!achado && o.name && o.name.toLowerCase().includes(texto.toLowerCase())) achado = o;
          });
          return achado;
        })()
      );
    },

    /** Raio aproximado do objeto, para escolher a distância sozinho. */
    raio(objeto) {
      let maior = 0;
      const centro = new objeto.position.constructor();
      objeto.getWorldPosition(centro);
      objeto.updateMatrixWorld(true);
      objeto.traverse((o) => {
        const geometria = o.geometry;
        if (!geometria) return;
        if (!geometria.boundingSphere) geometria.computeBoundingSphere();
        const esfera = geometria.boundingSphere;
        if (!esfera) return;
        const p = esfera.center.clone().applyMatrix4(o.matrixWorld);
        const escala = Math.max(
          Math.abs(o.matrixWorld.elements[0]),
          Math.abs(o.matrixWorld.elements[5]),
          Math.abs(o.matrixWorld.elements[10])
        );
        maior = Math.max(maior, p.distanceTo(centro) + esfera.radius * escala);
      });
      return maior || 1;
    },

    /**
     * Aponta a câmera para o objeto. `distancia` e `altura` em unidades da cena,
     * ou 'auto' para derivar do tamanho da peça; `angulo` gira em volta dela.
     */
    enquadrar(alvo, { distancia = 'auto', altura = 'auto', angulo = 0, mirar = 0.4 } = {}) {
      this._prender();
      const objeto = this.achar(alvo);
      if (!objeto) return { erro: `objeto não encontrado: ${alvo}` };
      // Se o app ainda não desenhou, tenta uma câmera que esteja dentro da cena.
      this._cameraApp ??= this.cena?.getObjectByProperty?.('isCamera', true) ?? null;
      if (!this._cameraApp) return { erro: 'nenhuma câmera encontrada (a cena já desenhou?)' };

      const raio = this.raio(objeto);
      const dist = distancia === 'auto' ? raio * 3.2 : distancia;
      const alt = altura === 'auto' ? raio * 1.1 : altura;

      const camera = (this._override ??= this._cameraApp.clone());
      const centro = new objeto.position.constructor();
      objeto.getWorldPosition(centro);
      camera.position.set(
        centro.x + Math.sin(angulo) * dist,
        centro.y + alt,
        centro.z + Math.cos(angulo) * dist
      );
      camera.lookAt(centro.x, centro.y + raio * mirar, centro.z);
      camera.updateMatrixWorld(true);

      return {
        nome: objeto.name || objeto.type,
        raio: Number(raio.toFixed(2)),
        distancia: Number(dist.toFixed(2)),
      };
    },

    soltar() {
      this._override = null;
      return 'câmera devolvida ao app';
    },
  };

  // Prende o renderer assim que ele nascer: a câmera do app só é descoberta no
  // primeiro desenho, e sem isso o primeiro enquadramento sairia sem câmera.
  const vigia = setInterval(() => {
    if (auditoria._prender()?.__auditoriaPresa) clearInterval(vigia);
  }, 60);
  setTimeout(() => clearInterval(vigia), 30000);

  window.__auditoria = auditoria;
})();
