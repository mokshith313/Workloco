import express from 'express';

export const aiRouter = express.Router();

// AI Job Description Generator for Indian Local Employers
aiRouter.post('/generate', (req, res) => {
  const { title, location_name, salary_hint, key_skills, role_type } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Job title is required.' });
  }

  const generated = generateLocalJobDescription({
    title,
    location_name: location_name || 'Your City',
    salary_hint: salary_hint || 'Competitive market salary',
    key_skills: key_skills || '',
    role_type: role_type || 'Full-time'
  });

  res.json({
    success: true,
    title,
    suggested_description: generated.description,
    suggested_perks: generated.perks,
    suggested_requirements: generated.requirements
  });
});

function generateLocalJobDescription({ title, location_name, salary_hint, key_skills, role_type }) {
  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes('photo') || lowerTitle.includes('video') || lowerTitle.includes('edit')) {
    return {
      description: `Urgent requirement for a creative ${title} at ${location_name}. We are looking for someone with hands-on experience in wedding/event coverage, fast turnaround editing, and creative storytelling. Candidate should have familiarity with Adobe Premiere Pro / DaVinci Resolve or Sony/Canon mirrorless setups. Payout: ${salary_hint}. Immediate joining with high seasonal incentives.`,
      requirements: [
        'Demonstrated portfolio or sample video links (YouTube/Drive/Instagram)',
        'Understanding of Indian wedding rituals and cinematography pacing',
        'Punctual, energetic, and collaborative team player'
      ],
      perks: [
        'On-the-spot project bonuses for peak wedding dates',
        'High-end studio workstation provided',
        'Direct WhatsApp coordination'
      ]
    };
  }

  if (lowerTitle.includes('cook') || lowerTitle.includes('chef') || lowerTitle.includes('kitchen') || lowerTitle.includes('baker')) {
    return {
      description: `Immediate opening for experienced ${title} at ${location_name}. Responsibilities include managing preparation, maintaining hygiene standards, and delivering consistent taste during peak rush hours. Payout: ${salary_hint}. Accommodation and daily meals provided.`,
      requirements: [
        'Previous experience in tiffin centers, restaurants, or commercial catering',
        'Ability to handle morning rushes and hygienic food prep',
        'Reliable attendance and team coordination'
      ],
      perks: [
        'Daily fresh food & tea provided',
        'Room accommodation option available',
        'Timely 1st-of-the-month salary guarantee'
      ]
    };
  }

  if (lowerTitle.includes('deliver') || lowerTitle.includes('rider') || lowerTitle.includes('driver')) {
    return {
      description: `Hiring ${title} for fast-growing hyperlocal logistics hub at ${location_name}. Flexible shifts with high volume orders. Payout: ${salary_hint} + per-order bonuses and fuel support. Daily or weekly payout options available.`,
      requirements: [
        'Two-wheeler in working condition with valid license',
        'Smartphone with active GPS/data connection',
        'Familiarity with local neighborhood roads and shortcuts'
      ],
      perks: [
        'Fuel allowance + extra surge pay during rain/festival peak',
        'Flexible 4-hour or 8-hour shift schedule',
        'Direct joining with zero deposit'
      ]
    };
  }

  if (lowerTitle.includes('electric') || lowerTitle.includes('plumb') || lowerTitle.includes('technician') || lowerTitle.includes('ac')) {
    return {
      description: `Immediate requirement for skilled ${title} in and around ${location_name}. Handling on-site service calls, installations, troubleshooting, and preventative maintenance. Payout: ${salary_hint}. Tool bag assistance provided.`,
      requirements: [
        'Practical field knowledge and troubleshooting expertise',
        'Own bike for local customer site visits',
        'Polite customer interaction and safety adherence'
      ],
      perks: [
        'Per-visit customer bonus incentives',
        'Uniform and safety kit provided',
        'Fast weekly settlement of travel expenses'
      ]
    };
  }

  // Default General / Business Role
  return {
    description: `We are hiring a dedicated ${title} to join our growing team at ${location_name}. Role involves daily operations, customer interaction, and ensuring smooth workflow. Payout: ${salary_hint}. Welcoming walk-in candidates and immediate joiners.`,
    requirements: [
      'Basic communication skills and positive attitude',
      'Relevant prior work or eagerness to learn on the job',
      'Punctual and dependable team member'
    ],
    perks: [
      'Friendly local work environment',
      'Regular performance increments',
      'Transparent direct employer communication'
    ]
  };
}
