// common/enums/beneficiary.enum.ts
export enum Pillar {
  TRAINING = 'TRAINING',
  INCUBATION = 'INCUBATION',
  ACCELERATION = 'ACCELERATION',
}

export enum TrainingTier {
  FOUNDATIONAL = 'FOUNDATIONAL',
  DEVELOPMENTAL = 'DEVELOPMENTAL',
  SPECIALISED = 'SPECIALISED',
}

export enum BeneficiaryStatus {
  SUBMITTED = 'SUBMITTED',
  TAGGED = 'TAGGED', // geo-mapped + hub-allocated
  MATCHED = 'MATCHED', // pushed to an ESO's cohort 
}
