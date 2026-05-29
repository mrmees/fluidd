import doc from '../../../../tests/fixtures/prompt-protocol/fixtures.json'
import { initialPromptState, parseAction, reducePrompt } from '@/util/prompt-protocol'
import { REDUCER_OPTS, canRun, toComparable } from './_fixture-helpers'

const fixtures = (doc as any).fixtures as Array<{
  id: string
  level: 'core' | 'optional'
  description?: string
  events: string[]
  expected?: any
  expected_by_frontend?: { [frontend: string]: any }
}>

describe.each(fixtures.filter(canRun))('fixture: $id ($level)', (fixture) => {
  it('produces expected state', () => {
    let state = initialPromptState()
    for (const line of fixture.events) {
      const event = parseAction(line)
      if (event) state = reducePrompt(state, event, REDUCER_OPTS)
    }
    const expected = fixture.expected_by_frontend?.fluidd ?? fixture.expected
    if (!expected) throw new Error(`fixture ${fixture.id} has no expected state`)
    expect(toComparable(state)).toMatchObject(expected)
  })
})
