import Marquee from './models/Marquee.js'; // Adjust path to your model file

class MarqueeService {
  /**
   * Create a new marquee
   * @param {Object} data - Marquee payload
   * @param {String} userId - ID of the user creating the marquee
   */
  async createMarquee(data, userId) {
    const marquee = new Marquee({
      ...data,
      createdBy: userId,
      updatedBy: userId,
    });
    
    return await marquee.save();
  }
}

export default new MarqueeService();