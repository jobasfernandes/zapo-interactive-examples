import { buttonsExample } from './buttons.js'
import { carouselExample } from './carousel.js'
import { catalogLinkExample, catalogMessageExample } from './catalog-solo.js'
import { catalogExample } from './catalog.js'
import { formExample } from './form.js'
import { groupStatusExample } from './group-status.js'
import { chargeExample, pixExample } from './pix.js'
import { productExample } from './product.js'
import type { Example } from './types.js'
import { webviewExample } from './webview.js'

// Order matters: the menu lists the examples that need a catalog last.
export const EXAMPLES: readonly Example[] = [
    buttonsExample,
    carouselExample,
    formExample,
    webviewExample,
    pixExample,
    chargeExample,
    productExample,
    catalogExample,
    catalogLinkExample,
    catalogMessageExample
]

/**
 * Every command the send CLI runs. The group status stays out of the menu: the list is at
 * WhatsApp's 10-row cap, and in the bot the command names the group it posts to.
 */
export const COMMANDS: readonly Example[] = [...EXAMPLES, groupStatusExample]

export function findExample(command: string): Example | undefined {
    return COMMANDS.find((example) => example.command === command.toLowerCase())
}
