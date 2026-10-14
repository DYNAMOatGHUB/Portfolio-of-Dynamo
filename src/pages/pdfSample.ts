import type { Page } from '../lib/retrieval';

// A short, made-up student handbook used as the demo document. Each entry is one PDF page.
export const SAMPLE_NAME = 'student-handbook.pdf';

export const SAMPLE: Page[] = [
  { page: 3, text: 'Every student must maintain a minimum of 75% attendance in each course to be eligible for the end semester examination. Students with attendance between 65% and 75% may apply for condonation with a valid medical certificate. Below 65%, the student must repeat the course in the next academic year.' },
  { page: 4, text: 'Medical leave must be reported to the class advisor within three working days of returning to campus. The certificate must be signed by a registered practitioner. Leave taken for sports or cultural events is approved by the department head and counts as on-duty.' },
  { page: 7, text: 'Electronic devices, including mobile phones, smartwatches and programmable calculators, are strictly prohibited inside the examination hall. Any student found carrying such a device will have the paper cancelled. Only a non-programmable scientific calculator approved by the invigilator is allowed.' },
  { page: 8, text: 'Students must be seated in the examination hall fifteen minutes before the start of the paper. Nobody is admitted more than thirty minutes after the start. Answer scripts may not be taken out of the hall under any circumstances.' },
  { page: 11, text: 'The central library is open from 8:00 am to 8:00 pm on weekdays and from 9:00 am to 1:00 pm on Saturdays. Each student may borrow up to four books at a time for a period of fourteen days. Reference books and journals cannot be borrowed and must be read inside the library.' },
  { page: 12, text: 'Books returned after the due date are charged a fine of ₹2 per day per book. If a book is lost, the student must replace it with a new copy or pay twice its current price. Borrowing privileges are suspended until all overdue fines are cleared.' },
  { page: 15, text: 'Hostel residents must return to campus before 9:30 pm. The main gate is closed at 9:30 pm and late entry is recorded by the warden. Three late entries in a month are reported to the parents. Visitors are allowed only in the common lounge between 4:00 pm and 6:00 pm.' },
  { page: 16, text: 'The hostel mess serves breakfast from 7:00 am to 8:30 am, lunch from 12:30 pm to 2:00 pm and dinner from 7:30 pm to 9:00 pm. Students on medical diets can request a separate menu through the warden. Cooking appliances are not permitted in hostel rooms.' },
  { page: 19, text: 'Merit scholarships are awarded to the top three students of each department based on the previous semester GPA. A tuition fee waiver of 50% is available for students whose annual family income is below ₹2.5 lakh. Applications open in the first two weeks of every semester.' },
];

export const SUGGESTED = [
  'Can I bring my laptop into the exam?',
  'What happens if I return a book late?',
  'How much attendance do I need?',
  'What time does the hostel gate close?',
  'What is the campus wifi password?',
];
