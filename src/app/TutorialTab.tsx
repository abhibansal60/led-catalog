import { BookOpenCheck } from "lucide-react";
import { BilingualText } from "@/components/BilingualText";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "./AppContext";

export function TutorialTab(): JSX.Element {

  return (
          <section
            id="catalog-tutorial-panel"
            role="tabpanel"
            aria-labelledby="catalog-tutorial-tab"
            className="flex flex-col gap-6"
          >
            <Card className="border border-border bg-card shadow-md">
              <CardHeader className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <BookOpenCheck className="h-7 w-7 text-primary" aria-hidden="true" />
                  <CardTitle>
                    <BilingualText
                      primary="Step-by-Step Tutorial"
                      secondary="स्टेप-बाय-स्टेप मदद"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-base text-muted-foreground"
                    />
                  </CardTitle>
                </div>
                <CardDescription className="text-base text-muted-foreground">
                  Follow these simple steps anytime you need a refresher. जब भी जरूरत पड़े, इन आसान स्टेप्स को पढ़ें और दोहराएं।
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">
                    <BilingualText
                      primary="Add a New Program"
                      secondary="नया प्रोग्राम जोड़ें"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-base text-muted-foreground"
                    />
                  </h3>
                  <ol className="space-y-3 text-base text-muted-foreground">
                    <li className="rounded-xl border border-border/60 bg-muted/50 p-4">
                      <BilingualText
                        primary="Open the “Add New Program” tab from the top."
                        secondary="ऊपर से “Add New Program” टैब खोलें।"
                        align="start"
                        className="items-start text-left font-semibold text-foreground"
                        secondaryClassName="text-base text-muted-foreground"
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Start with the program name so it is easy to recognise later. नाम लिखें ताकि बाद में तुरंत पहचान सकें।
                      </p>
                    </li>
                    <li className="rounded-xl border border-border/60 bg-muted/50 p-4">
                      <BilingualText
                        primary="Tap the LED file box and choose the .led file from your phone."
                        secondary="LED फाइल बॉक्स पर टैप करें और मोबाइल से .led फाइल चुनें।"
                        align="start"
                        className="items-start text-left font-semibold text-foreground"
                        secondaryClassName="text-base text-muted-foreground"
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Optional: add a short note or photo to remember where you will use it. चाहें तो छोटा नोट या फोटो जोड़ें ताकि याद रहे कहाँ चलाना है।
                      </p>
                    </li>
                    <li className="rounded-xl border border-border/60 bg-muted/50 p-4">
                      <BilingualText
                        primary="Press “Save Program”."
                        secondary="“Save Program” दबाएँ।"
                        align="start"
                        className="items-start text-left font-semibold text-foreground"
                        secondaryClassName="text-base text-muted-foreground"
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        The file stays safely in the app. फाइल सुरक्षित रूप से ऐप में सेव हो जाती है।
                      </p>
                    </li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">
                    <BilingualText
                      primary="Copy to SD Card"
                      secondary="SD कार्ड में कॉपी करें"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-base text-muted-foreground"
                    />
                  </h3>
                  <ol className="space-y-3 text-base text-muted-foreground">
                    <li className="rounded-xl border border-border/60 bg-muted/50 p-4">
                      <BilingualText
                        primary="From the catalog, tap the program you saved."
                        secondary="कैटलॉग में सेव किया हुआ प्रोग्राम चुनें।"
                        align="start"
                        className="items-start text-left font-semibold text-foreground"
                        secondaryClassName="text-base text-muted-foreground"
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Use the copy button that shows an SD card icon. SD कार्ड वाले बटन पर टैप करें।
                      </p>
                    </li>
                    <li className="rounded-xl border border-border/60 bg-muted/50 p-4">
                      <BilingualText
                        primary="Allow the app to open your SD card when asked."
                        secondary="पूछने पर ऐप को SD कार्ड खोलने की अनुमति दें।"
                        align="start"
                        className="items-start text-left font-semibold text-foreground"
                        secondaryClassName="text-base text-muted-foreground"
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        The file will be copied automatically as <code className="rounded bg-muted px-1 py-0.5 text-foreground">00_program.led</code>.
                        फाइल अपने आप <code className="rounded bg-muted px-1 py-0.5 text-foreground">00_program.led</code> नाम से कॉपी हो जाएगी।
                      </p>
                    </li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">
                    <BilingualText
                      primary="Confirm Everything Worked"
                      secondary="जाँच लें कि सब सही हुआ"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-base text-muted-foreground"
                    />
                  </h3>
                  <ol className="space-y-3 text-base text-muted-foreground">
                    <li className="rounded-xl border border-border/60 bg-muted/50 p-4">
                      <BilingualText
                        primary="Wait for the green success message."
                        secondary="हरी सफलता संदेश आने तक इंतज़ार करें।"
                        align="start"
                        className="items-start text-left font-semibold text-foreground"
                        secondaryClassName="text-base text-muted-foreground"
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        If you see an error, try again or check the SD card is unlocked. गलती आने पर दोबारा कोशिश करें या देखें SD कार्ड लॉक तो नहीं।
                      </p>
                    </li>
                    <li className="rounded-xl border border-border/60 bg-muted/50 p-4">
                      <BilingualText
                        primary="Open the SD card on your phone or computer and confirm the new file is there."
                        secondary="SD कार्ड मोबाइल या कंप्यूटर में खोलकर नई फाइल दिख रही है या नहीं देखें।"
                        align="start"
                        className="items-start text-left font-semibold text-foreground"
                        secondaryClassName="text-base text-muted-foreground"
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        The name should be <code className="rounded bg-muted px-1 py-0.5 text-foreground">00_program.led</code>. नाम <code className="rounded bg-muted px-1 py-0.5 text-foreground">00_program.led</code> होना चाहिए।
                      </p>
                    </li>
                    <li className="rounded-xl border border-border/60 bg-muted/50 p-4">
                      <BilingualText
                        primary="Insert the SD card into the controller and play it once."
                        secondary="SD कार्ड कंट्रोलर में लगाकर एक बार चला कर देखें।"
                        align="start"
                        className="items-start text-left font-semibold text-foreground"
                        secondaryClassName="text-base text-muted-foreground"
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        If the lights follow the new program, everything is perfect! लाइट्स नए प्रोग्राम के हिसाब से चलें तो सब ठीक है।
                      </p>
                    </li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </section>
  );
}
