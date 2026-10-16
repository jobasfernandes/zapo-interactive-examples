import { buttonsExample } from './buttons.js'
import { carouselExample } from './carousel.js'
import { catalogLinkExample, catalogMessageExample } from './catalog-solo.js'
import { catalogExample } from './catalog.js'
import { formExample } from './form.js'
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

export function findExample(command: string): Example | undefined {
    return EXAMPLES.find((example) => example.command === command.toLowerCase())
}
