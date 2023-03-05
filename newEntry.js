import { useState, useEffect, useContext } from 'react'
import Card from '@mui/material/Card'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import toast from 'react-hot-toast'
import Checkbox from '@mui/material/Checkbox'
import { useForm, Controller } from 'react-hook-form'
import Typography from '@mui/material/Typography'
import PageHeader from 'src/@core/components/page-header'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputLabel from '@mui/material/InputLabel'
import UploadReceipts from './UploadReceipts'
import { useDispatch, useSelector } from 'react-redux'
import { fetchAppClients } from 'src/store/app-clients/index'
import { fetchBillingNumbers } from 'src/store/billing-numbers/index'
import * as yup from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'
import axios from 'axios'
import { useAuth } from 'src/hooks/useAuth'
import { ButtonGroup, CircularProgress, Divider } from '@mui/material'
import { Box } from '@mui/system'
import Select from '@mui/material/Select'
import { AbilityContext } from 'src/layouts/components/acl/Can'
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import CustomChip from 'src/@core/components/mui/chip'
import CustomMessage from '../../../views/customMessage'
import { fetchMyEntries } from 'src/store/entries/my-entries'
import { addDraftData } from 'src/store/entries/draft-entry'
import { DesktopTimePicker } from '@mui/x-date-pickers/DesktopTimePicker'
import { DesktopDatePicker } from '@mui/x-date-pickers/DesktopDatePicker'
import moment from '../../../lib/moment'

const showErrors = (field, valueLen, min) => {
  if (valueLen === 0) {
    return `${field} field is required`
  } else if (valueLen > 0 && valueLen < min) {
    return `${field} must be at least ${min} characters`
  } else {
    return ''
  }
}

const schema = yup.object().shape({
  description: yup
    .string()
    .min(1, obj => showErrors('description', obj.value.length, obj.min))
    .required(),
  dateOfEntry: yup
    .date()
    .typeError('The Entry Date is required, and it should be a Date format.')
    .required('The Entry Date is required!')
    .max(new Date(), "You can't insert a Future time entry!"),
  startedAt: yup
    .date()
    .typeError('The started time is required, and it should be a time format.')
    .required('The started time is required!'),
  endedAt: yup
    .date()
    .typeError('The ended time is required, and it should be a time format.')
    .required('The ended time is required!'),
  internalEntry: yup.boolean(),
  client: yup.string().when('internalEntry', {
    is: false,
    then: yup.string().required()
  }),
  billingNumber: yup.string().when('internalEntry', {
    is: false,
    then: yup.string().required()
  })
})

const NewTimeEntry = () => {
  const auth = useAuth()
  const ability = useContext(AbilityContext)
  const [timeEntryForm, setTimeEntryForm] = useState(true)
  const [internalEntry, setInternalEntry] = useState(false)
  const [attachedReceipts, setAttachedReceipts] = useState(false)
  const [lastEntryId, setLastEntryId] = useState()
  const dispatch = useDispatch()
  const clientsList = useSelector(state => state.appClients)
  const billingNumbersList = useSelector(state => state.billingNumbers)
  const [submitingEntry, setSubmitingEntry] = useState(false)
  const [startedAt, setStartedAt] = useState(null)
  const [endedAt, setEndedAt] = useState(null)
  const [descriptionState, setDescriptionState] = useState()
  const [dateOfEntry, setDateOfEntry] = useState(null)
  const draftDescription = useSelector(state => state.draftEntry.description)
  const [dateDialog, setDateDialog] = useState(false)
  const [startedDialog, setStartedDialog] = useState(false)
  const [endedDialog, setEndedDialog] = useState(false)
  const myProfileStore = useSelector(state => state.myProfile.data)
  const store = useSelector(state => state.myEntries)
  const myId = myProfileStore?.id

  const handleAddDraftData = () => {
    dispatch(addDraftData({ draftDescription: descriptionState }))
  }

  const defaultValues = {
    description: draftDescription,
    client: '',
    startedAt: startedAt,
    endedAt: endedAt,
    dateOfEntry: dateOfEntry,
    internalEntry: internalEntry,
    attachedReceipts: attachedReceipts,
    billingNumber: ''
  }

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    defaultValues,
    mode: 'onChange',
    resolver: yupResolver(schema)
  })

  useEffect(() => {
    if (clientsList.data.length === 0) {
      dispatch(fetchAppClients())
    }
    if (billingNumbersList.data.length === 0) {
      dispatch(fetchBillingNumbers())
    }

    if (store.total === null) {
      if (myId) {
        dispatch(
          fetchMyEntries({
            clients: true,
            users: true,
            billingNumbers: true,
            receipt: true,
            user: myId
          })
        )
      }
    }
  }, [dispatch, myId, store.total])

  const handleInternalEntry = event => {
    setInternalEntry(event.target.checked)
  }

  const handleAttachedReceipts = event => {
    setAttachedReceipts(event.target.checked)
  }

  function clearUploadReceipt() {
    setTimeEntryForm(true)
    setAttachedReceipts(false)
    setLastEntryId(true)
    reset()
  }

  const handleError = error => {
    if (
      error.message === 'Started at date must be older than ended at date' ||
      error.message === 'Duration must be at least 5 minutes'
    ) {
      toast.error(error.message)
    } else {
      toast.error('An error occurred. Please try again later.')
    }
  }

  const validateForm = formParams => {
    const { startedAt, endedAt, internalEntry } = formParams
    if (startedAt.getTime() >= endedAt.getTime()) {
      throw new Error('Started at date must be older than ended at date')
    }

    const duration = Math.abs((endedAt.getTime() - startedAt.getTime()) / (1000 * 60))

    if (duration < 5) {
      throw new Error('Duration must be at least 5 minutes')
    }

    return {
      ...formParams,
      type: internalEntry ? 'internal' : 'external',
      status: 'unauthorized'
    }
  }

  const refreshMyEntries = () => {
    dispatch(
      fetchMyEntries({
        clients: true,
        users: true,
        billingNumbers: true,
        receipt: true,
        user: auth.user.id
      })
    )
  }

  const onSubmit = async params => {
    setSubmitingEntry(true)
    try {
      const { userId } = {
        userId: auth.user.id
      }
      const formParams = validateForm(params)

      let data = {
        formParams,
        userId,
        ...(!formParams.internalEntry && {
          intClient: Number(params.client),
          intBillingNumber: Number(params.billingNumber)
        })
      }

      const postStart = moment(moment(formParams.startedAt).toISOString())
      const postEnd = moment(moment(formParams.endedAt).toISOString())

      const overlappingEntries = store.data.filter(entry => {
        const dbStart = moment(entry.startedAt)
        const dbEnd = moment(entry.endedAt)

        return (
          (postStart.isSameOrAfter(dbStart) && postStart.isBefore(dbEnd)) ||
          (postEnd.isAfter(dbStart) && postEnd.isSameOrBefore(dbEnd)) ||
          (postStart.isSameOrBefore(dbStart) && postEnd.isSameOrAfter(dbEnd))
        )
      })

      if (overlappingEntries.length > 0) {
        toast.error('You Have a previous Entry with the same timeframe!')
      } else {
        if (attachedReceipts === true) {
          const { data: responseData } = await axios.post('/api/entries/new', data)
          setTimeEntryForm(false)
          setLastEntryId(responseData.lastEntryId.id)
          toast.success(responseData.message)
          toast.success(`Please attach the receipts using the form below`)
        } else {
          const { data: responseData } = await axios.post('/api/entries/new', data)
          toast.success(responseData.message)
          reset(defaultValues)
          refreshMyEntries()
        }
      }
    } catch (error) {
      setSubmitingEntry(false)
      console.log(error)
      handleError(error)
    } finally {
      setSubmitingEntry(false)
    }
  }

  if (ability?.can('create', 'new-entry')) {
    return (
      <Grid container spacing={6} className='match-height'>
        <PageHeader
          title={<Typography variant='h5'>Submit time</Typography>}
          subtitle={<Typography variant='body2'>Use the form below in order to create a new time entry</Typography>}
        />
        <Grid item xs={12}>
          <Card>
            {submitingEntry ? (
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 300
                }}
              >
                <CircularProgress />
              </Box>
            ) : (
              <>
                {timeEntryForm ? (
                  <>
                    <LocalizationProvider dateAdapter={AdapterMoment}>
                      <CardHeader
                        title={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography variant='h5' sx={{ mr: 3 }}>
                              New
                            </Typography>
                            {internalEntry ? (
                              <CustomChip label='Not Billable Time Entry' skin='light' size='small' color='info' />
                            ) : (
                              <CustomChip label='Billable Time Entry' skin='light' size='small' color='success' />
                            )}
                          </Box>
                        }
                      />
                      <CardContent>
                        <form onSubmit={handleSubmit(onSubmit)}>
                          <Grid container spacing={5}>
                            {/* Description */}
                            <Grid item xs={12} md={5}>
                              <FormControl fullWidth>
                                <Controller
                                  name='description'
                                  control={control}
                                  rules={{ required: true }}
                                  render={({ field: { value, onChange } }) => (
                                    <TextField
                                      rows={13}
                                      multiline
                                      tabIndex={1}
                                      value={value}
                                      label='Description'
                                      onChange={descData => {
                                        onChange(descData)
                                        setDescriptionState(descData.target.value)
                                      }}
                                      placeholder='Type your description here'
                                      error={Boolean(errors.description)}
                                      aria-describedby='description-validation'
                                    />
                                  )}
                                />
                                {errors.description && (
                                  <FormHelperText
                                    sx={{ ml: 0, mt: 2, color: 'error.main' }}
                                    id='description-validation'
                                  >
                                    {errors.description.message}
                                  </FormHelperText>
                                )}
                              </FormControl>
                            </Grid>

                            {/* Right inputs */}
                            <Grid item xs={12} md={7}>
                              <Grid container spacing={5}>
                                {/* date */}
                                <Grid item xs={12}>
                                  <FormControl fullWidth>
                                    <Controller
                                      name='dateOfEntry'
                                      tabIndex={3}
                                      control={control}
                                      rules={{ required: true }}
                                      render={({ field: { value, onChange } }) => (
                                        <DesktopDatePicker
                                          value={dateOfEntry}
                                          ampm={false}
                                          disableFuture={true}
                                          closeOnSelect={true}
                                          mask='__/__/____'
                                          open={dateDialog}
                                          onOpen={() => setDateDialog(true)}
                                          onClose={() => {
                                            setDateDialog(false)
                                          }}
                                          label='Entry Date'
                                          onChange={date => {
                                            onChange(date)
                                            setDateOfEntry(date)
                                            setStartedAt(date)
                                            setEndedAt(date)
                                            control._fields.startedAt._f.value = date
                                            control._fields.endedAt._f.value = date
                                          }}
                                          renderInput={params => (
                                            <TextField
                                              {...params}
                                              onClick={e => setDateDialog(true)}
                                              InputProps={{
                                                endAdornment: null
                                              }}
                                            />
                                          )}
                                        />
                                      )}
                                    />
                                    {errors.dateOfEntry && (
                                      <FormHelperText
                                        sx={{ ml: 0, mt: 2, color: 'error.main' }}
                                        id='dateOfEntry-validation'
                                      >
                                        {errors.dateOfEntry.message}
                                      </FormHelperText>
                                    )}
                                  </FormControl>
                                </Grid>

                                <Grid item xs={6}>
                                  <FormControl fullWidth>
                                    <Controller
                                      name='startedAt'
                                      tabIndex={4}
                                      control={control}
                                      rules={{ required: true }}
                                      render={({ field: { value, onChange } }) => (
                                        <DesktopTimePicker
                                          value={startedAt}
                                          ampm={false}
                                          label='Started At'
                                          closeOnSelect={true}
                                          open={startedDialog}
                                          onOpen={() => setStartedDialog(true)}
                                          onClose={() => {
                                            setStartedDialog(false)
                                          }}
                                          onChange={date => {
                                            onChange(date)
                                            setStartedAt(date)
                                            setEndedAt(date)
                                            control._fields.startedAt._f.value = date
                                            control._fields.endedAt._f.value = date
                                          }}
                                          renderInput={params => (
                                            <TextField
                                              {...params}
                                              onClick={e => setStartedDialog(true)}
                                              InputProps={{
                                                endAdornment: null
                                              }}
                                            />
                                          )}
                                        />
                                      )}
                                    />
                                    {errors.startedAt && (
                                      <FormHelperText
                                        sx={{ ml: 0, mt: 2, color: 'error.main' }}
                                        id='startedAt-validation'
                                      >
                                        {errors.startedAt.message}
                                      </FormHelperText>
                                    )}
                                  </FormControl>
                                </Grid>

                                <Grid item xs={6}>
                                  <FormControl fullWidth>
                                    <Controller
                                      name='endedAt'
                                      tabIndex={5}
                                      control={control}
                                      rules={{ required: true }}
                                      render={({ field: { value, onChange } }) => (
                                        <DesktopTimePicker
                                          value={endedAt}
                                          ampm={false}
                                          label='Ended At'
                                          closeOnSelect={true}
                                          open={endedDialog}
                                          onOpen={() => setEndedDialog(true)}
                                          onClose={() => setEndedDialog(false)}
                                          onChange={date => {
                                            onChange(date)
                                            setEndedAt(date)
                                            control._fields.startedAt._f.value = date
                                            control._fields.endedAt._f.value = date
                                          }}
                                          renderInput={params => (
                                            <TextField
                                              {...params}
                                              onClick={e => setEndedDialog(true)}
                                              InputProps={{
                                                endAdornment: null
                                              }}
                                            />
                                          )}
                                        />
                                      )}
                                    />
                                    {errors.endedAt && (
                                      <FormHelperText
                                        sx={{ ml: 0, mt: 2, color: 'error.main' }}
                                        id='endedAt-validation'
                                      >
                                        {errors.endedAt.message}
                                      </FormHelperText>
                                    )}
                                  </FormControl>
                                </Grid>

                                {/* If not an internal entry */}
                                {!internalEntry && (
                                  <>
                                    {/* Client */}
                                    <Grid item xs={12}>
                                      <FormControl fullWidth>
                                        <InputLabel
                                          id='client-validation'
                                          error={Boolean(errors.client)}
                                          htmlFor='client-validation'
                                        >
                                          Select Client
                                        </InputLabel>
                                        <Controller
                                          name='client'
                                          control={control}
                                          render={({ field: { value, onChange } }) => (
                                            <Select
                                              value={value}
                                              label='Select Client'
                                              onChange={onChange}
                                              tabIndex={5}
                                              error={Boolean(errors.client)}
                                              labelId='client-validation'
                                              aria-describedby='client-validation'
                                            >
                                              {clientsList.data.map(item => {
                                                return (
                                                  <MenuItem key={item.id} value={item.id}>
                                                    {item.name}
                                                  </MenuItem>
                                                )
                                              })}
                                            </Select>
                                          )}
                                        />
                                        {errors.client && (
                                          <FormHelperText
                                            sx={{ ml: 0, mt: 2, color: 'error.main' }}
                                            id='client-validation'
                                          >
                                            This field is required!
                                          </FormHelperText>
                                        )}
                                      </FormControl>
                                    </Grid>

                                    {/* Billing Number */}
                                    <Grid item xs={12}>
                                      <FormControl fullWidth>
                                        <InputLabel
                                          id='billingNumber-validation'
                                          error={Boolean(errors.billingNumber)}
                                          htmlFor='billingNumber-validation'
                                        >
                                          Select Billing Number
                                        </InputLabel>
                                        <Controller
                                          name='billingNumber'
                                          control={control}
                                          render={({ field: { value, onChange } }) => (
                                            <Select
                                              value={value}
                                              label='Select Billing Number'
                                              tabIndex={6}
                                              onChange={onChange}
                                              error={Boolean(errors.billingNumber)}
                                              labelId='billingNumber-validation'
                                              aria-describedby='billingNumber-validation'
                                            >
                                              {billingNumbersList.data.map(item => {
                                                return (
                                                  <MenuItem key={item.id} value={item.id}>
                                                    {item.desc} - {item.code}
                                                  </MenuItem>
                                                )
                                              })}
                                            </Select>
                                          )}
                                        />
                                        {errors.billingNumber && (
                                          <FormHelperText
                                            sx={{ ml: 0, mt: 2, color: 'error.main' }}
                                            id='billingNumber-validation'
                                          >
                                            This field is required!
                                          </FormHelperText>
                                        )}
                                      </FormControl>
                                    </Grid>
                                  </>
                                )}

                                {/* Internal Entry switch */}
                                <Grid item xs={12} sm={6}>
                                  <FormControl fullWidth>
                                    <Controller
                                      name='internalEntry'
                                      control={control}
                                      render={({ field: { value, onChange } }) => (
                                        <FormControlLabel
                                          label='Not Billable Time Entry'
                                          control={
                                            <Checkbox
                                              value={value}
                                              checked={internalEntry}
                                              onChange={e => {
                                                onChange(e), handleInternalEntry(e)
                                              }}
                                            />
                                          }
                                        />
                                      )}
                                    />
                                  </FormControl>
                                </Grid>

                                {/* Attach Receipt switch */}
                                {ability?.can('create', 'upload-reciept') && (
                                  <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth>
                                      <Controller
                                        name='attachedReceipts'
                                        control={control}
                                        rules={{ required: true }}
                                        render={({ field }) => (
                                          <FormControlLabel
                                            label='Attach Receipts?'
                                            control={
                                              <Switch checked={attachedReceipts} onChange={handleAttachedReceipts} />
                                            }
                                          />
                                        )}
                                      />
                                    </FormControl>
                                  </Grid>
                                )}
                              </Grid>
                            </Grid>

                            <Grid item xs={12}>
                              <ButtonGroup variant='contained' aria-label='Actions Buttons'>
                                <Button size='large' type='submit' variant='contained'>
                                  Submit
                                </Button>
                                <Button size='large' onClick={handleAddDraftData} color='warning' variant='outlined'>
                                  Draft Description
                                </Button>
                              </ButtonGroup>
                            </Grid>
                          </Grid>
                        </form>
                      </CardContent>
                    </LocalizationProvider>
                  </>
                ) : (
                  <>
                    <CardHeader
                      title={<Typography variant='h6'>Upload Receipts for your time entry</Typography>}
                      action={
                        <Button
                          size='large'
                          color='warning'
                          sx={{ mt: 3 }}
                          variant='outlined'
                          onClick={clearUploadReceipt}
                        >
                          Exit & Create a new Entry
                        </Button>
                      }
                    />
                    <Divider />
                    <CardContent>
                      <UploadReceipts lastEntryId={lastEntryId} />
                    </CardContent>
                  </>
                )}
              </>
            )}
          </Card>
        </Grid>
      </Grid>
    )
  } else {
    return <CustomMessage message={"you don't have permissions to create a new time entries"} />
  }
}

NewTimeEntry.acl = {
  action: 'read',
  subject: 'new-entry'
}

export default NewTimeEntry
