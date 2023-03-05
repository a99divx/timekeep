import { connect, disconnect, prisma } from '../../../lib/initPrisma'
import jwtVerify from '../../../lib/jwtVerify'
import moment from '../../../lib/moment'
import _ from 'lodash'

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

    const { formParams, entryId, recImage, dateIso } = req.body

    const data = {
      timeEntryId: Number(entryId),
      url: recImage,
      desc: formParams.desc,
      amount: _.toString(formParams.amount),
      currency: formParams.currency,
      exchangeRate: _.toString(formParams.exchangeRate),
      dateOfReceipt: moment.utc(dateIso).add(3, 'hours').toDate()
    }

    await connect()

    const Reciept = await prisma.Receipt.create({
      data
    })

    return res.status(200).json({
      message: `Your Reciept has been created!`,
      image: recImage,
      data: Reciept
    })
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Unknown error' })
  } finally {
    await disconnect()
  }
}
