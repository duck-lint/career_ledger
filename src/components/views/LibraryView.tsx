import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import RecordsView from '@/components/views/RecordsView'
import EvidenceView from '@/components/views/EvidenceView'
import CandidateProfileView from '@/components/views/CandidateProfileView'

export default function LibraryView() {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState('records')

  const handleRecordSelect = (recordId: string | null) => {
    setSelectedRecordId(recordId)
    if (recordId) {
      setActiveSection('evidence')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Library</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          SQLite-backed experience records, evidence, and candidate profile state.
        </p>
      </div>

      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="candidate-profile">Candidate Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-0">
          <RecordsView
            selectedRecordId={selectedRecordId}
            onRecordSelect={handleRecordSelect}
          />
        </TabsContent>

        <TabsContent value="evidence" className="mt-0">
          <EvidenceView
            selectedRecordId={selectedRecordId}
            onRecordSelect={setSelectedRecordId}
          />
        </TabsContent>

        <TabsContent value="candidate-profile" className="mt-0">
          <CandidateProfileView />
        </TabsContent>
      </Tabs>
    </div>
  )
}