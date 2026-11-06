export interface SelectedEsoRow {
  row: number;
  institutionId: string;
  institutionName: string;
  state: string;
  esoName: string;
}

export const SELECTED_ESOS_SOURCE = 'Selected_ESOs.xlsx';

export const SELECTED_ESOS: SelectedEsoRow[] = [
  {
    row: 1,
    institutionId: '0c9b8d16-a929-4449-8cd3-1391f7175796',
    institutionName: 'Benue State University',
    state: 'Benue',
    esoName: 'Gogetit Investments Ltd',
  },
  {
    row: 2,
    institutionId: '81e4d3e6-a12d-4761-8d1d-89057ff42ea9',
    institutionName: 'University of Ilorin',
    state: 'Kwara',
    esoName: 'Ilorin Innovation Hub',
  },
  {
    row: 3,
    institutionId: '82eeadc4-81cf-40c9-af3f-d93ef1f85d2a',
    institutionName: 'Federal University of Technology, Minna',
    state: 'Niger',
    esoName: 'Codextel Limited',
  },
  {
    row: 4,
    institutionId: '1c510fe8-ad6d-4204-84ec-7562eb5900c5',
    institutionName: 'Abdulkadir Kure University',
    state: 'Niger',
    esoName: 'Codextel Limited',
  },
  {
    row: 5,
    institutionId: '902c83e0-cb67-418c-9023-3d775e6c81b4',
    institutionName: 'Salem University',
    state: 'Kogi',
    esoName: 'Mentor-Box Foundation',
  },
  {
    row: 6,
    institutionId: '04e34081-9746-4d77-a729-c21c75147b8b',
    institutionName: 'National Open University of Nigeria (NOUN)',
    state: 'FCT',
    esoName: 'Wootlab Foundation',
  },
  {
    row: 7,
    institutionId: '3fb7b4e7-e625-44b9-b266-b74d5b38b2ae',
    institutionName: 'Federal Polytechnic Idah',
    state: 'Kogi',
    esoName: 'Mentor-Box Foundation',
  },
  {
    row: 8,
    institutionId: 'e1012e27-3058-4443-85c2-2eec0ee79a76',
    institutionName: 'Federal Polytechnic Nasarawa',
    state: 'Nasarawa',
    esoName: 'Wootlab Foundation',
  },
  {
    row: 9,
    institutionId: '00605d6a-980d-406e-a669-c49fc93044cd',
    institutionName: 'National Film Institute Jos',
    state: 'Plateau',
    esoName: 'nHub',
  },
  {
    row: 10,
    institutionId: '1fd0f539-e2b5-41ef-b9cd-0063d2bccfc7',
    institutionName: 'Kwara State Polytechnic',
    state: 'Kwara',
    esoName: 'Ilorin Innovation Hub',
  },
  {
    row: 11,
    institutionId: '530c10b5-061b-4b89-946e-adc1f59d9e2f',
    institutionName: 'Prince Abubakar Audu University',
    state: 'Kogi',
    esoName: 'Kogi Innovation Hub',
  },
];
