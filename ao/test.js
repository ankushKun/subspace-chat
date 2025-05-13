import { aofetch } from "ao-fetch"

const server = "bKKJjeOXr3ViedwUB6hz_Me3VFRxMXS0yTkZBkJEL3s"

const r1 = await aofetch(`${server}/`)
console.log(r1)