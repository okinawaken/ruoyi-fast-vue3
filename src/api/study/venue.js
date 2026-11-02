import request from '@/utils/study/request'

/**
 * 自习室 - 门店
 */
export const studyVenueApi = {
  select: (currentLng, currentLat) =>
    request.get('/business/study/venue/select', { params: { currentLng, currentLat } }),
  reserveSelect: () => request.get('/business/study/venue/reserve/select'),
  reserveDetail: venueId => request.get('/business/study/venue/reserve/detail', { params: { venueId } }),
  reserveIndex: params => request.get('/business/study/venue/reserve/index', { params }),
  reserveAreaSelect: () => request.get('/business/study/venue/reserve/area/select'),
  receiptSelect: (currentLng, currentLat) =>
    request.get('/business/study/venue/receipt/select', { params: { currentLng, currentLat } }),
  douyinSelect: (currentLng, currentLat) =>
    request.get('/business/study/venue/douyin/select', { params: { currentLng, currentLat } })
}
