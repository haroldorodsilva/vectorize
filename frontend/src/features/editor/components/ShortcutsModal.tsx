import { useState } from 'react'
import { Keyboard, X } from 'lucide-react'

const SHORTCUTS = [
  { group: 'Ferramentas', items: [
    { key: 'V', desc: 'Selecionar' }, { key: 'H', desc: 'Mover canvas' },
    { key: 'P', desc: 'Pintar' }, { key: 'E', desc: 'Borracha' },
    { key: 'R', desc: 'Retângulo' }, { key: 'O', desc: 'Elipse' },
    { key: 'L', desc: 'Linha' }, { key: 'T', desc: 'Texto' },
    { key: 'N', desc: 'Caneta Bézier' }, { key: 'G', desc: 'Polígono' },
    { key: 'F', desc: 'Desenho livre' }, { key: 'A', desc: 'Seta' },
    { key: 'I', desc: 'Conta-gotas' },
  ]},
  { group: 'Ações', items: [
    { key: 'Ctrl+Z', desc: 'Desfazer' }, { key: 'Ctrl+Shift+Z', desc: 'Refazer' },
    { key: 'Ctrl+C', desc: 'Copiar' }, { key: 'Ctrl+V', desc: 'Colar' },
    { key: 'Ctrl+D', desc: 'Duplicar' }, { key: 'Delete', desc: 'Excluir' },
    { key: 'Escape', desc: 'Sair modo edição' },
  ]},
  { group: 'Seleção', items: [
    { key: 'Shift+Click', desc: 'Multi-selecionar' },
    { key: 'Arrastar vazio', desc: 'Seleção retangular' },
    { key: 'Double-click path', desc: 'Editar nós' },
    { key: 'Double-click texto', desc: 'Editar texto' },
  ]},
  { group: 'Canvas', items: [
    { key: 'Scroll', desc: 'Zoom' },
    { key: 'Arrastar', desc: 'Pan (modo Pan)' },
    { key: 'Double-click vazio', desc: 'Reset zoom' },
  ]},
  { group: 'Pen Tool (N)', items: [
    { key: 'Click', desc: 'Adicionar ponto' },
    { key: 'Click+Drag', desc: 'Ponto com handle Bézier' },
    { key: 'Click 1° ponto', desc: 'Fechar path' },
    { key: 'Enter', desc: 'Confirmar path aberto' },
    { key: 'Escape', desc: 'Cancelar' },
  ]},
]

export function ShortcutsButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        title="Atalhos de teclado"
      >
        <Keyboard size={14} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto animate-in"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Atalhos de Teclado</h2>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>

            {SHORTCUTS.map(g => (
              <div key={g.group} className="mb-3">
                <h3 className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{g.group}</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {g.items.map(s => (
                    <div key={s.key} className="flex items-center justify-between py-0.5">
                      <span className="text-xs text-gray-600">{s.desc}</span>
                      <kbd className="text-[0.6rem] bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 font-mono text-gray-500">{s.key}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
