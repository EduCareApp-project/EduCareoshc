const fs = require('fs');
let code = fs.readFileSync('artifacts/portal/src/pages/excursions.tsx', 'utf8');

// Edit 1: ExcursionForm state initialization
code = code.replace(
  /const \[formData, setFormData\] = useState<Partial<ExcursionInput>>\(\{[\s\S]*?\}\);\s*\/\/ Only init once\s*const initialized = useRef\(false\);\s*useEffect\(\(\) => \{[\s\S]*?\}\);/m,
  `const [formData, setFormData] = useState<Partial<ExcursionInput>>({
    siteId: !isFullAccess && ownSiteId ? ownSiteId : undefined,
    excursionDate: new Date().toISOString().split("T")[0],
    heading: "",
    description: "",
    venue: "",
    purpose: "",
    cost: "Free",
    departureTime: "09:00 AM",
    arrivalAtVenue: "09:30 AM",
    departureFromVenue: "01:30 PM",
    arrivalTime: "02:00 PM",
    transportMethod: "Walking",
    restraintsFitted: "N/A",
    childToStaffRatio: "1:8",
    maximumChildren: "",
    staffAttending: "",
    otherInformation: "",
    itemsToBring: "Hat, drink bottle, sensible shoes",
    medicalAuthorisationText:
      "In the event of an emergency, illness, or accident concerning my child, and if the nominated contact people cannot be reached, I authorise the educator/person in charge to consent to my child receiving medical, dental, or surgical treatment as deemed necessary by a medical practitioner or hospital.",
  });

  // Only init once
  const initialized = useRef(false);
  useEffect(() => {
    if (editData && !initialized.current) {
      initialized.current = true;
      setFormData({
        siteId: editData.siteId,
        excursionDate: new Date(editData.excursionDate).toISOString().split("T")[0],
        heading: editData.heading,
        description: editData.description,
        venue: editData.venue,
        purpose: editData.purpose,
        cost: editData.cost,
        departureTime: editData.departureTime,
        arrivalAtVenue: editData.arrivalAtVenue,
        departureFromVenue: editData.departureFromVenue,
        arrivalTime: editData.arrivalTime,
        transportMethod: editData.transportMethod,
        restraintsFitted: editData.restraintsFitted,
        childToStaffRatio: editData.childToStaffRatio,
        maximumChildren: editData.maximumChildren,
        staffAttending: editData.staffAttending,
        otherInformation: editData.otherInformation,
        itemsToBring: editData.itemsToBring,
        medicalAuthorisationText: editData.medicalAuthorisationText,
        riskAssessmentPath: editData.riskAssessmentPath || undefined,
        riskAssessmentName: editData.riskAssessmentName || undefined,
      });
    }
  }, [editData]);`
);


// Edit 2: ExcursionForm UI layout
const oldFormUI = `          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isFullAccess && (
              <div className="space-y-1.5 md:col-span-2">
                <Label>
                  Site <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.siteId?.toString() ?? ""}
                  onValueChange={(v) => {
                    setFormData({ ...formData, siteId: parseInt(v), riskAssessmentPath: undefined, riskAssessmentName: undefined });
                    setRiskFile(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {(sites ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5 md:col-span-2">
              <Label>
                Heading <span className="text-destructive">*</span>
              </Label>
              <Input
                value={formData.heading}
                onChange={(e) =>
                  setFormData({ ...formData, heading: e.target.value })
                }
                placeholder="e.g. Local Library Storytime"
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={formData.excursionDate}
                onChange={(e) =>
                  setFormData({ ...formData, excursionDate: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Venue <span className="text-destructive">*</span>
              </Label>
              <Input
                value={formData.venue}
                onChange={(e) =>
                  setFormData({ ...formData, venue: e.target.value })
                }
                placeholder="e.g. City Library"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Departure Time</Label>
              <Input
                value={formData.departureTime}
                onChange={(e) =>
                  setFormData({ ...formData, departureTime: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Return Time</Label>
              <Input
                value={formData.arrivalTime}
                onChange={(e) =>
                  setFormData({ ...formData, arrivalTime: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Description of Activities</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="h-24"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Educational Purpose</Label>
              <Input
                value={formData.purpose}
                onChange={(e) =>
                  setFormData({ ...formData, purpose: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Risk Assessment PDF</Label>
              <div className="flex flex-col gap-2">
                <Input
                  type="file"
                  accept=".pdf"
                  disabled={!formData.siteId}
                  onChange={(e) => setRiskFile(e.target.files?.[0] || null)}
                />
                {!formData.siteId && (
                  <p className="text-xs text-muted-foreground">Please select a site first.</p>
                )}
                {formData.siteId && formData.riskAssessmentName && !riskFile && (
                  <p className="text-xs text-muted-foreground">Current: {formData.riskAssessmentName}</p>
                )}
              </div>
            </div>
          </div>

          <Separator />
          <h3 className="font-semibold text-base">Logistics</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Cost</Label>
              <Input
                value={formData.cost}
                onChange={(e) =>
                  setFormData({ ...formData, cost: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Transport Method</Label>
              <Input
                value={formData.transportMethod}
                onChange={(e) =>
                  setFormData({ ...formData, transportMethod: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Restraints Fitted?</Label>
              <Input
                value={formData.restraintsFitted}
                onChange={(e) =>
                  setFormData({ ...formData, restraintsFitted: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Child to Staff Ratio</Label>
              <Input
                value={formData.childToStaffRatio}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    childToStaffRatio: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Staff Attending</Label>
              <Input
                value={formData.staffAttending}
                onChange={(e) =>
                  setFormData({ ...formData, staffAttending: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Items to Bring</Label>
              <Input
                value={formData.itemsToBring}
                onChange={(e) =>
                  setFormData({ ...formData, itemsToBring: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Medical Authorisation Clause</Label>
              <Textarea
                value={formData.medicalAuthorisationText}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    medicalAuthorisationText: e.target.value,
                  })
                }
                className="h-20"
              />
            </div>
          </div>`;

const newFormUI = `          <div className="grid grid-cols-1 gap-4">
            <h3 className="font-semibold text-base mb-2">General Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isFullAccess && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label>
                    Site <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.siteId?.toString() ?? ""}
                    onValueChange={(v) => {
                      setFormData({ ...formData, siteId: parseInt(v), riskAssessmentPath: undefined, riskAssessmentName: undefined });
                      setRiskFile(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sites ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5 md:col-span-2">
                <Label>
                  Heading <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={formData.heading}
                  onChange={(e) =>
                    setFormData({ ...formData, heading: e.target.value })
                  }
                  placeholder="e.g. Local Library Storytime"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label>
                  Venue <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={formData.venue}
                  onChange={(e) =>
                    setFormData({ ...formData, venue: e.target.value })
                  }
                  placeholder="e.g. City Library"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label>Description of Activities (Internal Info)</Label>
                <Textarea
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="h-20"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label>Risk Assessment PDF</Label>
                <div className="flex flex-col gap-2">
                  <Input
                    type="file"
                    accept=".pdf"
                    disabled={!formData.siteId}
                    onChange={(e) => setRiskFile(e.target.files?.[0] || null)}
                  />
                  {!formData.siteId && (
                    <p className="text-xs text-muted-foreground">Please select a site first.</p>
                  )}
                  {formData.siteId && formData.riskAssessmentName && !riskFile && (
                    <p className="text-xs text-muted-foreground">Current: {formData.riskAssessmentName}</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-1.5 md:col-span-2">
                <Label>Medical Authorisation Clause</Label>
                <Textarea
                  value={formData.medicalAuthorisationText || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      medicalAuthorisationText: e.target.value,
                    })
                  }
                  className="h-20"
                />
              </div>
            </div>
          </div>

          <Separator />
          
          <div className="grid grid-cols-1 gap-4">
            <div className="flex flex-col mb-2">
              <h3 className="font-semibold text-base">Permission Form</h3>
              <p className="text-sm text-muted-foreground">Fill in the fields exactly as they will appear on the final permission document.</p>
            </div>
            
            <Card className="shadow-none rounded-sm border-2 overflow-hidden">
              <div className="bg-[#4a89d6] text-white py-3 px-4">
                <h4 className="text-center text-lg font-bold">{formData.heading || "Excursion Heading"}</h4>
              </div>
              <CardContent className="p-6 grid gap-y-5">
                
                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-start">
                  <Label className="font-bold text-sm pt-2 text-foreground">Purpose of Activity:</Label>
                  <Textarea
                    value={formData.purpose || ""}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    className="min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-center">
                  <Label className="font-bold text-sm text-foreground">Date:</Label>
                  <Input
                    type="date"
                    value={formData.excursionDate || ""}
                    onChange={(e) => setFormData({ ...formData, excursionDate: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-center">
                  <Label className="font-bold text-sm text-foreground">Cost:</Label>
                  <Input
                    value={formData.cost || ""}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8">
                  <div className="grid grid-cols-1 xl:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-center">
                    <Label className="font-bold text-sm text-foreground">Time of Departure from School:</Label>
                    <Input
                      value={formData.departureTime || ""}
                      onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-[200px_1fr] gap-x-4 gap-y-2 items-center">
                    <Label className="font-bold text-sm text-foreground">Time of arrival at Venue:</Label>
                    <Input
                      value={formData.arrivalAtVenue || ""}
                      onChange={(e) => setFormData({ ...formData, arrivalAtVenue: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8">
                  <div className="grid grid-cols-1 xl:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-center">
                    <Label className="font-bold text-sm text-foreground">Time of Departure from Venue:</Label>
                    <Input
                      value={formData.departureFromVenue || ""}
                      onChange={(e) => setFormData({ ...formData, departureFromVenue: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-[200px_1fr] gap-x-4 gap-y-2 items-center">
                    <Label className="font-bold text-sm text-foreground">Time of arrival at School:</Label>
                    <Input
                      value={formData.arrivalTime || ""}
                      onChange={(e) => setFormData({ ...formData, arrivalTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-center mt-2">
                  <Label className="font-bold text-sm text-foreground">Method of Transport:</Label>
                  <Input
                    value={formData.transportMethod || ""}
                    onChange={(e) => setFormData({ ...formData, transportMethod: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-center">
                  <Label className="font-bold text-sm text-foreground">Restraints fitted:</Label>
                  <Input
                    value={formData.restraintsFitted || ""}
                    onChange={(e) => setFormData({ ...formData, restraintsFitted: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-center">
                  <Label className="font-bold text-sm text-foreground">Child to staff ratios:</Label>
                  <Input
                    value={formData.childToStaffRatio || ""}
                    onChange={(e) => setFormData({ ...formData, childToStaffRatio: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-center">
                  <Label className="font-bold text-sm text-foreground">Maximum of Children</Label>
                  <Input
                    value={formData.maximumChildren || ""}
                    onChange={(e) => setFormData({ ...formData, maximumChildren: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-center">
                  <Label className="font-bold text-sm text-foreground">Staff in attendance:</Label>
                  <Input
                    value={formData.staffAttending || ""}
                    onChange={(e) => setFormData({ ...formData, staffAttending: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-start mt-2">
                  <Label className="font-bold text-sm pt-2 text-foreground">Other Information:</Label>
                  <Textarea
                    value={formData.otherInformation || ""}
                    onChange={(e) => setFormData({ ...formData, otherInformation: e.target.value })}
                    className="min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-start mt-2">
                  <Label className="font-bold text-sm pt-2 text-foreground">Children will need to bring:</Label>
                  <Textarea
                    value={formData.itemsToBring || ""}
                    onChange={(e) => setFormData({ ...formData, itemsToBring: e.target.value })}
                    className="min-h-[80px]"
                  />
                </div>

              </CardContent>
            </Card>
          </div>`;

code = code.replace(oldFormUI, newFormUI);

// Edit 3: Detail View reordering
// Need to find the exact block and replace it.
const regexDetail = /<section className="p-5 sm:p-6 space-y-4" data-testid="section-guardian-permissions">[\s\S]*?(?=<\/div>\s*<\/div>\s*<\/div>\s*\);)/;
const newDetail = `<section className="p-5 sm:p-6" data-testid="section-logistics-details">
            <div className="border-b pb-4 mb-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Excursion information
              </p>
              <h2 className="mt-1 text-xl font-semibold">Permission Form</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The practical information provided to families with the permission form.
              </p>
            </div>
            
            <Card className="shadow-none rounded-sm border-2 overflow-hidden">
              <div className="bg-[#4a89d6] text-white py-3 px-4">
                <h3 className="text-center text-lg font-bold">{detail.heading}</h3>
              </div>
              <CardContent className="p-6 text-sm text-foreground grid gap-y-5">
                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
                  <div className="font-bold">Purpose of Activity:</div>
                  <div className="whitespace-pre-wrap">{detail.purpose}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
                  <div className="font-bold">Date:</div>
                  <div>{new Date(detail.excursionDate).toLocaleDateString("en-AU")}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
                  <div className="font-bold">Cost:</div>
                  <div>{detail.cost}</div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8 mt-1">
                  <div className="grid grid-cols-1 xl:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
                    <div className="font-bold">Time of Departure from School:</div>
                    <div className="text-[#4a89d6]">{detail.departureTime}</div>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-[200px_1fr] gap-x-4 gap-y-1">
                    <div className="font-bold">Time of arrival at Venue:</div>
                    <div className="text-[#4a89d6]">{detail.arrivalAtVenue}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8">
                  <div className="grid grid-cols-1 xl:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
                    <div className="font-bold">Time of Departure from Venue:</div>
                    <div className="text-[#4a89d6]">{detail.departureFromVenue}</div>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-[200px_1fr] gap-x-4 gap-y-1">
                    <div className="font-bold">Time of arrival at School:</div>
                    <div className="text-[#4a89d6]">{detail.arrivalTime}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1 mt-1">
                  <div className="font-bold">Method of Transport:</div>
                  <div className="whitespace-pre-wrap">{detail.transportMethod}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
                  <div className="font-bold">Restraints fitted:</div>
                  <div>{detail.restraintsFitted}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
                  <div className="font-bold">Child to staff ratios:</div>
                  <div className="whitespace-pre-wrap">{detail.childToStaffRatio}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
                  <div className="font-bold">Maximum of Children</div>
                  <div>{detail.maximumChildren}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
                  <div className="font-bold">Staff in attendance:</div>
                  <div className="whitespace-pre-wrap">{detail.staffAttending}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1 mt-1">
                  <div className="font-bold">Other Information:</div>
                  <div className="whitespace-pre-wrap">{detail.otherInformation}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1 mt-1">
                  <div className="font-bold">Children will need to bring:</div>
                  <div className="whitespace-pre-wrap">{detail.itemsToBring}</div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="border-t p-5 sm:p-6" data-testid="section-activity-log">
            <div className="border-b pb-4 mb-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Record history
              </p>
              <h2 className="mt-1 text-xl font-semibold">Activity Log</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A chronological record of sending, viewing, reminders, and guardian responses.
              </p>
            </div>
            <Card className="shadow-none">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {detail.logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex gap-4 items-start text-sm"
                    >
                      <div className="w-32 shrink-0 text-muted-foreground text-xs pt-0.5">
                        {new Date(log.createdAt).toLocaleString("en-AU", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                      <div>
                        <span className="font-medium">{log.event}</span>
                        {log.guardianEmail && (
                          <span className="text-muted-foreground ml-2">
                            ({log.guardianEmail})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {detail.logs.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No activity recorded yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="border-t p-5 sm:p-6 space-y-4" data-testid="section-guardian-permissions">
            <div className="border-b pb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Permission responses
              </p>
              <h2 className="mt-1 text-xl font-semibold">Guardian Permissions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review each child&apos;s permission status and follow up with guardians who have not responded.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button
                  variant={filter === "all" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("all")}
                  className="h-9"
                >
                  All
                </Button>
                <Button
                  variant={filter === "pending" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("pending")}
                  className="h-9"
                >
                  Waiting
                </Button>
                <Button
                  variant={filter === "granted" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("granted")}
                  className="h-9"
                >
                  Granted
                </Button>
              </div>

              <div className="flex gap-2">
                {detail.status === "sent" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemind()}
                    disabled={sendReminder.isPending}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {sendReminder.isPending ? "Sending..." : "Remind Pending"}
                  </Button>
                )}
                {detail.status !== "completed" && (
                  <AddRecipientsDialog
                    excursionId={detail.id}
                    siteId={detail.siteId}
                  />
                )}
              </div>
            </div>

            <Card className="overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Guardian Email</TableHead>
                    <TableHead>Child</TableHead>
                    <TableHead>Viewed / Acknowledged</TableHead>
                    <TableHead>Permission</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGuardians.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-32 text-center text-muted-foreground"
                      >
                        No recipients match this filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredGuardians.map((g) => (
                      <TableRow key={g.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="font-medium text-sm">
                            {g.guardianNameSnapshot || "Guardian"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {g.guardianEmail}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-muted-foreground text-sm">
                          {g.childNameSnapshot}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground space-y-1">
                            {g.viewedAt ? (
                              <div>
                                Viewed:{" "}
                                {new Date(g.viewedAt).toLocaleDateString()}
                              </div>
                            ) : (
                              <div>Not viewed</div>
                            )}
                            {g.acknowledgedAt && (
                              <div>
                                Ack'd:{" "}
                                {new Date(
                                  g.acknowledgedAt,
                                ).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {g.decision === "granted" && (
                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">
                              Granted
                            </Badge>
                          )}
                          {g.decision === "declined" && (
                            <Badge variant="destructive">Declined</Badge>
                          )}
                          {!g.decision && (
                            <Badge
                              variant="secondary"
                              className="text-muted-foreground font-normal"
                            >
                              Waiting
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {detail.status === "draft" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" title="Remove Recipient" onClick={() => handleRemoveRecipient(g.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </section>`;

// Because match contains all the Table content which is quite long, I'll extract what's inside section-guardian-permissions.
const detailMatch = code.match(/<section className="p-5 sm:p-6 space-y-4" data-testid="section-guardian-permissions">[\s\S]*?(?=<\/div>\s*<\/div>\s*<\/div>\s*\);)/);
if(detailMatch) {
  // We need to keep everything inside the section-guardian-permissions table but the container changes slightly. Wait, our `newDetail` has the full Table code replicated perfectly.
  code = code.replace(detailMatch[0], newDetail);
} else {
  console.log("Could not find detail section");
}

fs.writeFileSync('artifacts/portal/src/pages/excursions.tsx', code);
