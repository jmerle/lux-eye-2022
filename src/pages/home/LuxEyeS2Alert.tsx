import { Alert, AlertProps } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons';

export function LuxEyeS2Alert(props: Omit<AlertProps, 'children'> = {}): JSX.Element {
  return (
    <>
      {/* prettier-ignore */}
      <Alert icon={<IconAlertCircle size={16} />} title="Important" color="orange" {...props}>
        Lux Eye 2022 has been renamed to Lux Eye S2 and is now the official visualizer for the <a href="https://www.kaggle.com/competitions/lux-ai-season-2" target="_blank" rel="noreferrer">Lux AI Season 2</a> competition.
        Lux Eye S2 is available at <a href="https://s2vis.lux-ai.org/" target="_blank" rel="noreferrer">https://s2vis.lux-ai.org/</a>.
        The version of Lux Eye 2022 deployed to this website only supports Lux AI 2022 Beta episodes, for Lux AI Season 2 episodes you should use Lux Eye S2.
      </Alert>
    </>
  );
}
