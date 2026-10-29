import React, { useState } from 'react';
import type { Project, SalesPlan } from '../types';
import { ProjectGate } from '../components/ProjectGate';
import { useStore } from '../state/store';
import { Badge, Button, Card, CopyButton, Field, Grid, Notice, PageHeader, Select, TextArea, TextInput, Toggle } from '../components/ui';

export function SalesStudio(): React.ReactElement {
  return (
    <ProjectGate feature="the sales studio">
      {(project) => <SalesWorkspace project={project} />}
    </ProjectGate>
  );
}

function SalesWorkspace({ project }: { project: Project }): React.ReactElement {
  const { updateProject, toast } = useStore();
  const plan = project.salesPlan;
  const [offerPrice, setOfferPrice] = useState(plan.price);

  const patch = (update: Partial<SalesPlan>) => {
    updateProject(project.id, (item) => ({ ...item, salesPlan: { ...item.salesPlan, ...update } }));
  };

  const generate = () => {
    const audience = plan.audience || 'your audience';
    const problem = plan.problem || 'a problem you have not defined yet';
    const outcome = plan.outcome || 'the outcome you can honestly deliver';
    const offer = plan.offer || 'your offer';
    const valueProposition = `For ${audience} who struggle with ${problem}, ${offer} helps them ${outcome}.`;
    const positioning = `Built for ${audience}. Focused on ${outcome}. Priced at ${plan.price || 'a price you will state plainly'}.`;
    const hooks = [
      `If ${problem} sounds familiar, this is for ${audience}.`,
      `${offer} exists because ${problem} is expensive to ignore.`,
      `The honest version of ${outcome} — including what it does not do.`,
      `Three things to check before you pay for anything that promises ${outcome}.`,
      `${audience}: here is the smallest useful version of the fix.`,
    ];
    const variations = [
      `Direct response: problem → mechanism → demonstration → price → action.`,
      `Documentary first: tell the story of the problem, then show ${offer} only at the end.`,
      `Comparison: show what a viewer could do manually versus what ${offer} removes.`,
      `Objection-first: open with the strongest reason not to buy, then answer it honestly.`,
    ];
    const abTests = [
      'Hook test: consequence-first vs mechanism-first. Keep the rest of the script identical.',
      'Proof test: one concrete demonstration vs two. Measure 3-second hold, not just views.',
      'Length test: 30s cut of the same argument vs 45s.',
      'CTA test: single action vs action plus a free resource. No fake urgency in either.',
    ];
    const steps = plan.steps.map((step) => {
      if (step.content) return step;
      const draft: Record<string, string> = {
        Attention: hooks[0],
        Problem: `State the problem plainly: ${problem}.`,
        Stakes: 'Describe the cost of leaving it alone, only with numbers you can source.',
        Explanation: 'Explain the mechanism. Specific beats dramatic.',
        Solution: `Describe what ${offer} actually does — nothing more.`,
        Evidence: 'Add only evidence you can show: documentation, a demo, a documented case.',
        Objections: `Name the real objection, then answer it without dismissiveness.`,
        Offer: `State the offer, the price and the limits honestly: ${plan.price || '[set price]'}.`,
        'Call to action': plan.desiredAction || 'One action. One link.',
      };
      return { ...step, content: draft[step.step] ?? '' };
    });
    patch({ valueProposition, positioning, hooks, variations, abTests, steps });
    toast('Deliverables generated from your inputs. Edit anything that overclaims.', 'success');
  };

  const includedSteps = plan.steps.filter((step) => step.included);

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Persuasion"
        title="Sales Studio"
        description="Content that informs, positions honestly, and asks for a decision — without invented proof, fake scarcity or guaranteed outcomes."
        actions={
          <div className="row gap-sm">
            <Button variant="ghost" onClick={() => (window.location.hash = '#/scripts')}>
              Write the script
            </Button>
            <Button variant="primary" onClick={generate}>
              Generate deliverables
            </Button>
          </div>
        }
      />

      <Notice tone="danger" title="Non-negotiable">
        Never invent testimonials, guarantees, customer counts, results or scarcity. AscendCC only structures your inputs.
        It cannot promise conversions, sales, reach or virality — and neither should the script.
      </Notice>

      <Grid columns={2}>
        <Card title="Audience and offer" subtitle="The inputs that make persuasion honest">
          <div className="stack-sm">
            <Field label="Target audience">
              <TextInput value={plan.audience} onChange={(event) => patch({ audience: event.target.value })} placeholder="Who exactly is this for?" />
            </Field>
            <Field label="Audience problem" hint="Their words, not your marketing language.">
              <TextArea rows={2} value={plan.problem} onChange={(event) => patch({ problem: event.target.value })} />
            </Field>
            <Field label="Desired outcome">
              <TextArea rows={2} value={plan.outcome} onChange={(event) => patch({ outcome: event.target.value })} />
            </Field>
            <Grid columns={2}>
              <Field label="Awareness level">
                <Select
                  value={plan.awarenessLevel}
                  options={[
                    { value: 'unaware', label: 'Unaware' },
                    { value: 'problem-aware', label: 'Problem aware' },
                    { value: 'solution-aware', label: 'Solution aware' },
                    { value: 'product-aware', label: 'Product aware' },
                    { value: 'most-aware', label: 'Most aware' },
                  ]}
                  onChange={(event) => patch({ awarenessLevel: event.target.value as SalesPlan['awarenessLevel'] })}
                />
              </Field>
              <Field label="Buying context">
                <TextInput value={plan.buyingContext} onChange={(event) => patch({ buyingContext: event.target.value })} placeholder="Where they see this, what they are doing" />
              </Field>
              <Field label="Offer">
                <TextInput value={plan.offer} onChange={(event) => patch({ offer: event.target.value })} />
              </Field>
              <Field label="Price" hint="State it on screen if the video is direct response.">
                <TextInput
                  value={offerPrice}
                  onChange={(event) => {
                    setOfferPrice(event.target.value);
                    patch({ price: event.target.value });
                  }}
                  placeholder="e.g. R0 / R199 / contact for quote"
                />
              </Field>
            </Grid>
            <Field label="Main objections" hint="One per line. Answer them, do not dismiss them.">
              <TextArea rows={3} value={plan.objections} onChange={(event) => patch({ objections: event.target.value })} />
            </Field>
            <Field label="Evidence available" hint="Only what you can actually show on camera.">
              <TextArea rows={2} value={plan.evidence} onChange={(event) => patch({ evidence: event.target.value })} />
            </Field>
            <Field label="Desired action">
              <TextInput value={plan.desiredAction} onChange={(event) => patch({ desiredAction: event.target.value })} placeholder="One action, one link" />
            </Field>
          </div>
        </Card>

        <div className="stack">
          <Card title="Generated outputs" subtitle="Templates filled with your inputs — edit before use">
            {plan.valueProposition ? (
              <div className="stack-sm">
                <div>
                  <span className="field-label">Value proposition</span>
                  <p className="quote">{plan.valueProposition}</p>
                </div>
                <div>
                  <span className="field-label">Positioning</span>
                  <p className="quote">{plan.positioning}</p>
                </div>
                <div>
                  <span className="field-label">Benefit-led hooks</span>
                  <ul className="deliverable-list">
                    {plan.hooks.map((hook) => (
                      <li key={hook}>
                        <span>{hook}</span>
                        <CopyButton text={hook} />
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="field-label">Script variations</span>
                  <ul className="numbered-list">
                    {plan.variations.map((variation) => (
                      <li key={variation}>{variation}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="field-label">A/B test ideas</span>
                  <ul className="numbered-list">
                    {plan.abTests.map((test) => (
                      <li key={test}>{test}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="muted">Fill in the audience and offer, then generate deliverables. Nothing is invented for you.</p>
            )}
          </Card>

          <Card title="Persuasion structure" subtitle={`${includedSteps.length} steps included — not every video needs all nine`}>
            <div className="stack-sm">
              {plan.steps.map((step) => (
                <div key={step.id} className={`sales-step ${step.included ? 'is-included' : ''}`}>
                  <Toggle
                    checked={step.included}
                    onChange={(checked) =>
                      patch({ steps: plan.steps.map((item) => (item.id === step.id ? { ...item, included: checked } : item)) })
                    }
                    label={step.step}
                  />
                  {step.included && (
                    <TextArea
                      rows={2}
                      placeholder={`What happens at the ${step.step.toLowerCase()} step?`}
                      value={step.content}
                      onChange={(event) =>
                        patch({
                          steps: plan.steps.map((item) => (item.id === step.id ? { ...item, content: event.target.value } : item)),
                        })
                      }
                    />
                  )}
                </div>
              ))}
              <div className="row gap-sm">
                <Badge tone="warning">No fake scarcity</Badge>
                <Badge tone="warning">No invented results</Badge>
                <Badge tone="neutral">Educational first</Badge>
              </div>
            </div>
          </Card>
        </div>
      </Grid>
    </div>
  );
}
