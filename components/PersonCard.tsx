import type { Author, Person } from "../types/api.ts";
import { CongressBadges } from "./CongressBadges.tsx";

interface PersonCardProps {
  person: Person | Author;
  showStats?: boolean;
}

export const PersonCard = ({ person, showStats = false }: PersonCardProps) => {
  // Type guard to check if person has full Person data
  const isPerson = (p: Person | Author): p is Person => {
    return "authoredDocuments" in p;
  };

  return (
    <article class="person-card">
      <div class="person-card-header">
        <div class="person-avatar">
          {person.firstName.charAt(0)}
          {person.lastName.charAt(0)}
        </div>
        <div class="person-info">
          <h3>
            <a href={`/people/${person.personId}`}>
              {person.firstName} {person.lastName}
            </a>
          </h3>
          {person.nickName &&
            person.nickName !== `${person.firstName} ${person.lastName}` && (
            <p class="nickname">"{person.nickName}"</p>
          )}
        </div>
      </div>

      <div class="person-card-body">
        <CongressBadges congresses={person.congresses} />

        {showStats && isPerson(person) && (
          <div class="person-stats">
            <div class="stat">
              <span class="stat-value">{person.authoredDocuments.length}</span>
              <span class="stat-label">Authored</span>
            </div>
            <div class="stat">
              <span class="stat-value">
                {person.coAuthoredDocuments.length}
              </span>
              <span class="stat-label">Co-Authored</span>
            </div>
            <div class="stat">
              <span class="stat-value">{person.committees.length}</span>
              <span class="stat-label">Committees</span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
};
