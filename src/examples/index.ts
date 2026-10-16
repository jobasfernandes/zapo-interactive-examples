import { buttonsExample } from './buttons.js'
import { carouselExample } from './carousel.js'
import { formExample } from './form.js'
import type { Example } from './types.js'
import { webviewExample } from './webview.js'

export const EXAMPLES: readonly Example[] = [buttonsExample, carouselExample, formExample, webviewExample]

export function findExample(command: string): Example | undefined {
    return EXAMPLES.find((example) => example.command === command.toLowerCase())
}
