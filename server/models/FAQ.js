import mongoose from 'mongoose';

const faqSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true },
  answer: { type: String, required: true },
  category: {
    type: String,
    required: true,
    enum: [
      'Medical Transportation', 'Care Assistant', 'Doctor Consultation', 
      'Diagnostics', 'Pharmacy Services', 'Subscription Plans', 'General'
    ],
    default: 'General'
  },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likeCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Pre-save middleware to keep likeCount in sync with the likes array length
faqSchema.pre('save',  async function() {
  if (this.isModified('likes')) {
    this.likeCount = this.likes.length;
  }
   
});

const FAQ = mongoose.model('FAQ', faqSchema);
export default FAQ;