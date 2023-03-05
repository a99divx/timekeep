import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Button, Card, CardContent, Chip, Divider, FormControl, FormHelperText, Grid, TextField } from '@mui/material'
import DropzoneWrapper from 'src/@core/styles/libs/react-dropzone'
import { Alert, AlertTitle, CircularProgress } from '@mui/material'
import LinearProgress from '@mui/material/LinearProgress'
import * as yup from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'
import { useForm, Controller } from 'react-hook-form'
import Select from '@mui/material/Select'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Icon from 'src/@core/components/icon'
import moment from '../../../lib/moment'
import s3 from '../../../lib/initS3'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { DesktopDatePicker } from '@mui/x-date-pickers/DesktopDatePicker'
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment'
import InputAdornment from '@mui/material/InputAdornment'

const HeadingTypography = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(5),
  [theme.breakpoints.down('sm')]: {
    marginBottom: theme.spacing(4)
  }
}))

const Img = styled('img')(({ theme }) => ({
  right: 0,
  bottom: 0,
  width: '100%',
  position: 'static',
  [theme.breakpoints.down('sm')]: {
    width: 250,
    position: 'static'
  }
}))

const schema = yup.object().shape({
  desc: yup.string(),
  amount: yup.number().typeError('Amount must be a number').max(5000000, 'Maximum Amount is 5,000,000'),
  commission: yup.number().typeError('Commission must be a number').max(100, 'Maximum Commission is 100'),
  currency: yup.string().required(),
  exchangeRate: yup.number().typeError('Exchange Rate must be a number').max(5000000, 'Maximum Exchange Rate is 500'),
  dateOfReceipt: yup.date().typeError('Expected a Date but got: ${value}'),
  timeEntryId: yup.string().required()
})

const UploadReceipts = ({ lastEntryId }) => {
  const [files, setFiles] = useState([])
  const [progresspercent, setProgresspercent] = useState(0)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [startUploading, setStartUploading] = useState(false)
  const [imgUrl, setImgUrl] = useState(null)
  const [showButtons, setShowButtons] = useState(false)
  const [creatingReciept, setCreatingReciept] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [imgObj, setImgObj] = useState()
  const [expandedImg, setExpandedImg] = useState()
  const [imgLoading, setImgLoading] = useState(true)
  const [dateOfrec, setDateOfrec] = useState(moment().format('YYYY-MM-DD'))

  const handleChange = (panel, objectKey) => async (event, isExpanded) => {
    setImgLoading(true)
    try {
      setExpandedImg(`https://timecapsule-bucket.s3.amazonaws.com/${objectKey}`)
    } catch (error) {
      console.error(error)
    } finally {
      setExpanded(isExpanded ? panel : false)
      setTimeout(() => {
        setImgLoading(false)
      }, 1000)
    }
  }

  const defaultValues = {
    desc: ' ',
    amount: 0,
    commission: 0,
    currency: 'USD',
    exchangeRate: 0,
    dateOfReceipt: dateOfrec,
    timeEntryId: lastEntryId
  }

  const {
    formState: { errors },
    control,
    handleSubmit,
    reset
  } = useForm({
    defaultValues,
    mode: 'onChange',
    resolver: yupResolver(schema)
  })

  const handleRefresh = useCallback(() => {
    fetchData()
  }, [data])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await axios.get('/api/entries/entry', {
        params: {
          id: lastEntryId,
          receipts: true
        }
      })
      setData(response.data.entry)
    } catch (error) {
      console.log(error)
    }
    setLoading(false)
  }

  const { getRootProps, getInputProps } = useDropzone({
    multiple: false,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    },
    onDrop: acceptedFiles => {
      setFiles(acceptedFiles.map(file => Object.assign(file)))
      setShowButtons(true)
    }
  })

  const img = files.map(file => <img key={file.name} width={'100%'} alt={file.name} src={URL.createObjectURL(file)} />)

  const handleUpload = async () => {
    try {
      setStartUploading(true)

      const objectKey = `reciepts/${data.uuid}-${files[0].name}`

      const params = {
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME,
        Key: objectKey,
        Body: files[0],
        ContentType: files[0].type
      }

      const upload = s3.putObject(params)

      upload.on('httpUploadProgress', evt => {
        const progress = Math.round((evt.loaded / evt.total) * 100)
        setProgresspercent(progress)
        setShowButtons(false)
      })

      await upload.promise()

      const url = await s3.getSignedUrlPromise('getObject', {
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME,
        Key: objectKey
      })
      setImgUrl(url)
      setImgObj(objectKey)
    } catch (err) {
      console.log(err)
    }
  }

  const handleRemoveAllFiles = () => {
    setFiles([])
  }

  const updateReciepts = async params => {
    setCreatingReciept(true)
    try {
      const { formParams, entryId, recImage } = { formParams: params, entryId: lastEntryId, recImage: imgObj }
      const dateIso = formParams.dateOfReceipt
      let data = { formParams, entryId, recImage, dateIso }
      const { data: responseData } = await axios.post('/api/receipts/upload', data)

      toast.success(responseData.message)
      setCreatingReciept(false)
      reset()
      handleRefresh()
      setFiles([])
      setProgresspercent(0)
      setImgUrl(null)
      setShowButtons(false)
      setStartUploading(false)
    } catch (error) {
      console.log(error)
      setCreatingReciept(false)
      toast.error('An error occurred. Please try again later.')
    }
  }

  return (
    <>
      <Grid container spacing={5}>
        <Grid item sm={12} md={6}>
          <DropzoneWrapper sx={{ mb: 5 }}>
            {startUploading ? (
              <>
                {!imgUrl && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', textAlign: 'center' }}>
                    <Box sx={{ width: '100%', mb: 5 }}>
                      <Typography variant='h3'>Uploading {`${progresspercent}%`}</Typography>
                      <Typography variant='caption'>Please wait while we upload your reciept!</Typography>
                    </Box>
                    <Box sx={{ width: '100%', mr: 1 }}>
                      <LinearProgress variant='determinate' value={progresspercent} />
                    </Box>
                  </Box>
                )}
                {imgUrl && (
                  <>
                    <Box sx={{ textAlign: 'center' }}>
                      <Img width={'350'} alt='Upload img' src={imgUrl} />
                    </Box>
                    <Alert severity='success'>
                      <AlertTitle>Success</AlertTitle>
                      Your receipt has been uploaded, you can use the form on the right to enter the reciept data.
                    </Alert>
                  </>
                )}
              </>
            ) : (
              <div {...getRootProps({ className: 'dropzone' })} sx={files.length ? { height: 450 } : {}}>
                <input {...getInputProps()} />
                {!files.length ? (
                  <Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Img width={300} alt='Upload img' src='/images/misc/upload.png' />
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        flexDirection: 'column',
                        textAlign: ['center', 'center', 'inherit']
                      }}
                    >
                      <HeadingTypography variant='h5'>Drop files here or click to upload.</HeadingTypography>
                      <Typography color='textSecondary'>Allowed *.jpeg, *.jpg, *.png, *.gif</Typography>
                      <Typography color='textSecondary'>Max 2 files and max size of 2 MB</Typography>
                    </Box>
                  </Box>
                ) : (
                  <Box>{img}</Box>
                )}
              </div>
            )}
          </DropzoneWrapper>

          {showButtons && (
            <Box>
              <div className='buttons'>
                <Button color='error' variant='outlined' sx={{ mr: 5 }} onClick={handleRemoveAllFiles}>
                  Remove All
                </Button>
                <Button variant='contained' onClick={handleUpload}>
                  Upload Files
                </Button>
              </div>
            </Box>
          )}
          <Alert severity='info' sx={{ mt: 5 }}>
            If you left this page by mistake, you can include receipts to your time entry by visiting{' '}
            <strong>Time Entries Table</strong>
          </Alert>
        </Grid>
        <Grid item sm={12} md={6}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {data && (
                <Box>
                  <Typography variant='h6'>Inserting Reciepts to your entry number "{data.id}"</Typography>
                  {!imgUrl ? (
                    <>
                      <Typography variant='caption'>Please upload the Receipts Images one by one, </Typography>
                      <Typography variant='caption'>
                        After <strong>uploading</strong> we will show up the reciept data form
                      </Typography>
                      <Divider />

                      {data.Receipt.length >= 1 ? (
                        <>
                          <Typography variant='h6' sx={{ mb: 5 }}>
                            Entry Reciepts
                          </Typography>
                          {data.Receipt.map((item, index) => {
                            return (
                              <Accordion
                                key={index}
                                expanded={expanded === index}
                                onChange={handleChange(index, item.url)}
                              >
                                <AccordionSummary
                                  id='controlled-panel-header-1'
                                  aria-controls='controlled-panel-content-1'
                                  expandIcon={<Icon icon='mdi:chevron-down' />}
                                >
                                  <Typography>
                                    No: {item.id} | Date: {moment(item.dateOfReceipt).format('MM/DD/YYYY')}
                                  </Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                  {imgLoading ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                      <CircularProgress />
                                    </Box>
                                  ) : (
                                    <>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 5 }}>
                                        <Box>
                                          <Typography variant='caption'>Description:</Typography>
                                          <Typography variant='body1' sx={{ mb: 5 }}>
                                            {item.desc}
                                          </Typography>
                                        </Box>
                                        <Box>
                                          {item.invoiced ? (
                                            <Chip label='Invoiced' color='info' variant='outlined' />
                                          ) : (
                                            <Chip label='Not Invoiced' color='warning' variant='outlined' />
                                          )}
                                        </Box>
                                      </Box>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 5 }}>
                                        <Box>
                                          <Typography variant='caption'>Amount:</Typography>
                                          <Typography variant='body1'>
                                            {item.amount} {item.currency}
                                          </Typography>
                                        </Box>
                                        <Box>
                                          <Typography variant='caption'>Exchange Rate:</Typography>
                                          <Typography variant='body1'>{item.exchangeRate}</Typography>
                                        </Box>
                                        <Box>
                                          <Typography variant='caption'>Date Created</Typography>
                                          <Typography variant='body1'>
                                            {moment(item.createdAt).format('MM/DD/YYYY')}
                                          </Typography>
                                        </Box>
                                      </Box>

                                      <Img width={'350'} alt='Upload img' src={expandedImg} />
                                    </>
                                  )}
                                </AccordionDetails>
                              </Accordion>
                            )
                          })}
                        </>
                      ) : (
                        <Typography variant='h6'>Couldn't find reciepts.</Typography>
                      )}
                    </>
                  ) : (
                    <Card>
                      <CardContent>
                        <LocalizationProvider dateAdapter={AdapterMoment}>
                          <form onSubmit={handleSubmit(updateReciepts)}>
                            <Grid container spacing={5}>
                              <Grid item sm={12} md={12}>
                                <Grid container spacing={5}>
                                  {/* desc */}
                                  <Grid item xs={12}>
                                    <FormControl fullWidth>
                                      <Controller
                                        name='desc'
                                        control={control}
                                        render={({ field: { value, onChange } }) => (
                                          <TextField
                                            value={value}
                                            label='Description'
                                            onChange={onChange}
                                            placeholder='Type your Description here'
                                            error={Boolean(errors.desc)}
                                            aria-describedby='desc-validation'
                                          />
                                        )}
                                      />
                                      {errors.desc && (
                                        <FormHelperText sx={{ ml: 0, mt: 2, color: 'error.main' }} id='desc-validation'>
                                          {errors.desc.message}
                                        </FormHelperText>
                                      )}
                                    </FormControl>
                                  </Grid>
                                  {/* Amount */}
                                  <Grid item xs={8}>
                                    <FormControl fullWidth>
                                      <Controller
                                        name='amount'
                                        control={control}
                                        render={({ field: { value, onChange } }) => (
                                          <TextField
                                            value={value}
                                            label='Amount'
                                            onChange={onChange}
                                            placeholder='Type the Amount here'
                                            error={Boolean(errors.amount)}
                                            aria-describedby='amount-validation'
                                          />
                                        )}
                                      />
                                      {errors.amount && (
                                        <FormHelperText
                                          sx={{ ml: 0, mt: 2, color: 'error.main' }}
                                          id='amount-validation'
                                        >
                                          {errors.amount.message}
                                        </FormHelperText>
                                      )}
                                    </FormControl>
                                  </Grid>
                                  {/* Commission */}
                                  <Grid item xs={4}>
                                    <FormControl fullWidth>
                                      <Controller
                                        name='commission'
                                        control={control}
                                        render={({ field: { value, onChange } }) => (
                                          <TextField
                                            value={value}
                                            InputProps={{
                                              endAdornment: <InputAdornment position='end'>%</InputAdornment>
                                            }}
                                            label='Commission'
                                            onChange={onChange}
                                            placeholder='Commission'
                                            error={Boolean(errors.commission)}
                                            aria-describedby='commission-validation'
                                          />
                                        )}
                                      />
                                      {errors.commission && (
                                        <FormHelperText
                                          sx={{ ml: 0, mt: 2, color: 'error.main' }}
                                          id='commission-validation'
                                        >
                                          {errors.commission.message}
                                        </FormHelperText>
                                      )}
                                    </FormControl>
                                  </Grid>
                                  {/* currency */}
                                  <Grid item xs={12}>
                                    <FormControl fullWidth>
                                      <InputLabel
                                        id='currency-validation'
                                        error={Boolean(errors.currency)}
                                        htmlFor='currency-validation'
                                      >
                                        Select currency
                                      </InputLabel>
                                      <Controller
                                        name='currency'
                                        control={control}
                                        render={({ field: { value, onChange } }) => (
                                          <Select
                                            value={value}
                                            label='Select currency'
                                            onChange={onChange}
                                            error={Boolean(errors.currency)}
                                            labelId='currency-validation'
                                            aria-describedby='currency-validation'
                                          >
                                            <MenuItem key='USD' value='USD'>
                                              USD
                                            </MenuItem>
                                            <MenuItem key='IQD' value='IQD'>
                                              IQD
                                            </MenuItem>
                                          </Select>
                                        )}
                                      />
                                      {errors.currency && (
                                        <FormHelperText
                                          sx={{ ml: 0, mt: 2, color: 'error.main' }}
                                          id='currency-validation'
                                        >
                                          This field is required!
                                        </FormHelperText>
                                      )}
                                    </FormControl>
                                  </Grid>
                                  {/* exchangeRate */}
                                  <Grid item xs={12}>
                                    <FormControl fullWidth>
                                      <Controller
                                        name='exchangeRate'
                                        control={control}
                                        render={({ field: { value, onChange } }) => (
                                          <TextField
                                            value={value}
                                            label='Exchange Rate'
                                            onChange={onChange}
                                            placeholder='Type the Exchange Rate here'
                                            error={Boolean(errors.exchangeRate)}
                                            aria-describedby='exchangeRate-validation'
                                          />
                                        )}
                                      />
                                      {errors.exchangeRate && (
                                        <FormHelperText
                                          sx={{ ml: 0, mt: 2, color: 'error.main' }}
                                          id='exchangeRate-validation'
                                        >
                                          {errors.exchangeRate.message}
                                        </FormHelperText>
                                      )}
                                    </FormControl>
                                  </Grid>
                                  {/* dateOfReceipt */}
                                  <Grid item xs={12}>
                                    <FormControl fullWidth>
                                      <Controller
                                        name='dateOfReceipt'
                                        tabIndex={3}
                                        control={control}
                                        render={({ field: { value, onChange } }) => (
                                          <DesktopDatePicker
                                            value={dateOfrec}
                                            ampm={false}
                                            disableFuture={true}
                                            mask='__/__/____'
                                            label='Receipt Date'
                                            onChange={date => {
                                              onChange(date)
                                              setDateOfrec(date)
                                              control._fields.dateOfReceipt._f.value = date
                                            }}
                                            renderInput={params => <TextField {...params} />}
                                          />
                                        )}
                                      />
                                      {errors.dateOfReceipt && (
                                        <FormHelperText
                                          sx={{ ml: 0, mt: 2, color: 'error.main' }}
                                          id='dateOfReceipt-validation'
                                        >
                                          {errors.dateOfReceipt.message}
                                        </FormHelperText>
                                      )}
                                    </FormControl>
                                  </Grid>
                                </Grid>
                              </Grid>
                              <Grid item xs={12}>
                                <Button type='submit' size='large' variant='contained'>
                                  {!creatingReciept ? 'Submit' : <CircularProgress color='inherit' />}
                                </Button>
                              </Grid>
                            </Grid>
                          </form>
                        </LocalizationProvider>
                      </CardContent>
                    </Card>
                  )}
                </Box>
              )}
            </>
          )}
        </Grid>
      </Grid>
    </>
  )
}

export default UploadReceipts
