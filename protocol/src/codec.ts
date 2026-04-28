const enc = new TextEncoder()
const dec = new TextDecoder()

export const encode = <T>(value: T): Uint8Array => enc.encode(JSON.stringify(value))
export const decode = <T>(payload: Uint8Array): T => JSON.parse(dec.decode(payload)) as T
