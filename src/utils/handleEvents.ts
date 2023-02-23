import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

import { Event, EventsMap, Metadata, UsersMap, UserStanding } from '../types.js'
import { handleEvent } from './index.js'

export const handleEvents = (
  events: string[],
  input: string,
  output: string
) => {
  const seasonUsers: UsersMap = new Map()
  const seasonEvents: EventsMap = new Map()
  let metadata: Metadata = {}

  if (events.includes('metadata.json')) {
    metadata = JSON.parse(readFileSync(`${input}/metadata.json`, 'utf8'))
    events.splice(events.indexOf('metadata.json'), 1)
  }

  for (const event of events) {
    const { levels, users } = handleEvent(`${input}/${event}`)

    for (const [steamId, user] of users) {
      const seasonUser = seasonUsers.get(steamId)
      if (seasonUser) {
        seasonUser.username = user.username
      } else {
        seasonUsers.set(steamId, {
          username: user.username,
          totalPoints: 0
        })
      }
    }

    for (const [, data] of levels) {
      for (const item of data) {
        const user = users.get(item.steamId)
        if (user) {
          user.totalPoints += item.points ?? 0
        }

        const seasonUser = seasonUsers.get(item.steamId)
        item.username = seasonUser?.username ?? user?.username ?? ''
      }
    }

    for (const [steamId, user] of users) {
      const seasonUser = seasonUsers.get(steamId)
      if (seasonUser) {
        seasonUser.totalPoints += user.totalPoints / levels.size
      }
    }

    seasonEvents.set(event, levels)

    if (!existsSync(output)) {
      mkdirSync(output)
    }

    writeFileSync(
      `${output}/${event.replace('../', '')}.json`,
      JSON.stringify(
        {
          users: [...users]
            .sort((a, b) => b[1].totalPoints - a[1].totalPoints)
            .map(([steamId, user]) => ({
              ...user,
              steamId
            })),
          levels: [...levels].map(([level, standings]) => ({
            level,
            standings
          }))
        } as Event,
        undefined,
        2
      )
    )
  }

  writeFileSync(
    `${output}/standings.json`,
    JSON.stringify(
      [...seasonUsers]
        .sort((a, b) => b[1].totalPoints - a[1].totalPoints)
        .map(
          ([steamId, user]) =>
            ({
              ...user,
              steamId,
              totalPoints: Number(user.totalPoints.toFixed(2))
            } as UserStanding)
        ),
      undefined,
      2
    )
  )

  writeFileSync(
    `${output}/metadata.json`,
    JSON.stringify(metadata, undefined, 2)
  )

  console.log(
    `Generated leaderboard data for ${seasonEvents.size} events in`,
    output
  )

  return { metadata }
}
