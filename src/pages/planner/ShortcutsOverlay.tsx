import { Modal } from '../../components/ui';

const GROUPS: { title: string; keys: [string[], string][] }[] = [
  {
    title: 'Tools',
    keys: [
      [['V'], 'Select and move'],
      [['P'], 'Draw a freeform area'],
      [['R'], 'Draw a rectangle'],
      [['L'], 'Draw a walk route'],
      [['H'], 'Pan (or hold Space)'],
      [['S'], 'Snapping on or off'],
    ],
  },
  {
    title: 'While drawing',
    keys: [
      [['Enter'], 'Finish the shape or route'],
      [['Backspace'], 'Remove the last point'],
      [['Esc'], 'Cancel'],
      [['Alt'], 'Hold to place points without snapping'],
    ],
  },
  {
    title: 'Selected shape',
    keys: [
      [['←', '→', '↑', '↓'], 'Nudge (hold Shift for bigger steps)'],
      [['Ctrl', 'D'], 'Duplicate'],
      [['Ctrl', 'C'], 'Copy'],
      [['Ctrl', 'V'], 'Paste a copy'],
      [['Del'], 'Delete'],
      [['Esc'], 'Deselect'],
    ],
  },
  {
    title: 'History and help',
    keys: [
      [['Ctrl', 'Z'], 'Undo a move or reshape'],
      [['Ctrl', 'Shift', 'Z'], 'Redo (or Ctrl Y)'],
      [['?'], 'Show these shortcuts'],
    ],
  },
];

/** Every planner shortcut, opened with "?" or the keyboard button. */
export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" description="On a Mac, use ⌘ instead of Ctrl." onClose={onClose} wide>
      <div className="shortcut-groups">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h4>{g.title}</h4>
            <dl>
              {g.keys.map(([keys, what]) => (
                <div key={what}>
                  <dt>
                    {keys.map((k) => (
                      <kbd key={k}>{k}</kbd>
                    ))}
                  </dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}
