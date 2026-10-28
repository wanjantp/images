/**
 * Collects audio from a chat-completions response that carries audio output,
 * either streamed (SSE lines with choices[0].delta.audio.data base64 chunks)
 * or a single JSON body (choices[0].message.audio.data). No Electron imports.
 */
export interface CollectedAudio {
  bytes: Buffer
  id?: string
  transcript?: string
  text: string
}

export async function collectAudio(r: Response): Promise<CollectedAudio> {
  const chunks: Buffer[] = []
  let id: string | undefined
  let transcript = ''
  let text = ''

  const take = (j: Record<string, unknown>): void => {
    id = (j.id as string | undefined) ?? id
    const choice = (j.choices as Array<Record<string, unknown>> | undefined)?.[0]
    if (!choice) return
    const part = (choice.delta ?? choice.message) as Record<string, unknown> | undefined
    if (!part) return
    const audio = part.audio as { data?: string; transcript?: string } | undefined
    if (audio?.data) chunks.push(Buffer.from(audio.data, 'base64'))
    if (audio?.transcript) transcript += audio.transcript
    if (typeof part.content === 'string') text += part.content
  }

  const ctype = r.headers.get('content-type') ?? ''
  if (ctype.includes('application/json')) {
    take((await r.json()) as Record<string, unknown>)
  } else {
    const reader = r.body!.getReader()
    const dec = new TextDecoder()
    let buf = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') continue
        try { take(JSON.parse(data) as Record<string, unknown>) } catch { /* ignore partial */ }
      }
    }
  }
  return { bytes: Buffer.concat(chunks), id, transcript: transcript || undefined, text }
}
