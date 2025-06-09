/*
  This is the solution to the following error:
  Property 'em-emoji' does not exist on type 'JSX.IntrinsicElements'.ts(2339)
*/

// Define em-emoji web component inside React
// https://github.com/missive/emoji-mart#-emoji-component
interface EmEmojiProps {
    id?: string
    shortcodes?: string
    native?: string
    size?: string
    fallback?: string
    set?: 'native' | 'apple' | 'facebook' | 'google' | 'twitter'
    skin?: 1 | 2 | 3 | 4 | 5 | 6
}
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace JSX {
        interface IntrinsicElements {
            'em-emoji': EmEmojiProps
        }
    }
}