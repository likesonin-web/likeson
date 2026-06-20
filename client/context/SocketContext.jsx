import {
  linkGeneratedFromSocket,
  paidFromSocket,
  serviceCompletedFromSocket,
} from '@/store/slices/payAtServiceSlice';

socket.on('pay_at_service_link_generated', (data) => {
  dispatch(linkGeneratedFromSocket(data));
});

socket.on('pay_at_service_paid', (data) => {
  dispatch(paidFromSocket(data));
});

// booking_status_change fires from /complete route
socket.on('booking_status_change', (data) => {
  if (data.status === 'completed') {
    dispatch(serviceCompletedFromSocket(data));
  }
});