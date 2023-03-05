import { connect, disconnect, prisma } from '../../../lib/initPrisma'
import jwtVerify from '../../../lib/jwtVerify'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(400).json({ error: 'Invalid request method' })
  }

  try {
    const token = req.headers['authorization']
    const jwtStatus = jwtVerify(token)
    if (jwtStatus === false) {
      return res.status(400).send(token)
    }

    const { formParams, userId } = req.body
    const { description, startedAt, endedAt, type, status, dateOfEntry } = formParams

    const data = {
      desc: description,
      userId,
      startedAt,
      endedAt,
      type,
      status,
      dateOfEntry
    }

    if (req.body.hasOwnProperty('intClient')) {
      data.clientId = req.body.intClient
    }
    if (req.body.hasOwnProperty('intBillingNumber')) {
      data.billingNumberId = req.body.intBillingNumber
    }

    await connect()

    const TimeEntry = await prisma.TimeEntry.create({
      data
    })

    return res.status(200).json({
      message: `Your ${type} Entry has been created!`,
      lastEntryId: TimeEntry
    })
  } catch (error) {
    if (error.message === 'Error connecting to the database') {
      return res.status(500).send('Error connecting to the database')
    } else {
      return res.status(400).json({ error: error.message || 'Unknown error' })
    }
  } finally {
    await disconnect()
  }
}
