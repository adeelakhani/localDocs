import type { Command } from 'commander'
import { getConfig, setConfig, type Config } from '../../config/ConfigManager.js'

const VALID_KEYS: (keyof Config)[] = ['chatModel']

export function registerConfig(program: Command): void {
  const config = program
    .command('config')
    .description('manage localdocs configuration')

  config
    .command('set <key> <value>')
    .description('set a config value')
    .action((key: string, value: string) => {
      if (!VALID_KEYS.includes(key as keyof Config)) {
        console.error(`Unknown config key: ${key}`)
        console.error(`Valid keys: ${VALID_KEYS.join(', ')}`)
        process.exit(1)
      }
      setConfig(key as keyof Config, value)
      console.log(`✓ Set ${key} = ${value}`)
    })

  config
    .command('show')
    .description('show current config')
    .action(() => {
      const cfg = getConfig()
      console.log('\nCurrent config:\n')
      for (const [k, v] of Object.entries(cfg)) {
        console.log(`  ${k}: ${v}`)
      }
    })
}
