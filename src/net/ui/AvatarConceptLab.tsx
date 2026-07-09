import { PlayerFace } from '@/boards/PlayerFace'
import {
  AVATARS,
  avatarLabel,
  type AvatarId,
} from '@/boards/playerAvatarCatalog'
import {
  SKINS,
  skinLabel,
  type SkinId,
} from '@/boards/playerSkinCatalog'

const PERSONALITY: Record<AvatarId, string> = {
  'classic-alive': 'Olhar atento e sorriso vivo',
  'orbital-eyes': 'Olhos livres em órbita',
  'single-line': 'Traço contínuo e curioso',
  'prism-face': 'Facetas que capturam a luz',
  'totem-face': 'Blocos com ritmo próprio',
}

export function AvatarConceptLab({
  color,
  avatar,
  skin,
  onAvatarChange,
  onSkinChange,
}: {
  color: string
  avatar: AvatarId
  skin: SkinId
  onAvatarChange: (avatar: AvatarId) => void
  onSkinChange: (skin: SkinId) => void
}) {
  const avatarName = avatarLabel(avatar)
  const skinName = skinLabel(skin)

  return (
    <div className="avatar-concept-lab">
      <div
        className="identity-passport__portrait avatar-concept-lab__stage"
        role="img"
        aria-label={`Avatar ${avatarName} com skin ${skinName}`}
        data-avatar={avatar}
        data-skin={skin}
      >
        <PlayerFace
          key={`${avatar}:${skin}`}
          color={color}
          avatar={avatar}
          skin={skin}
          size="92%"
          className="avatar-concept-lab__art"
        />
      </div>

      <div className="avatar-concept-lab__meta" aria-live="polite">
        <strong>{avatarName} · {skinName}</strong>
        <span>{PERSONALITY[avatar]}</span>
      </div>

      <div className="avatar-concept-lab__pickers">
        <fieldset className="avatar-concept-lab__picker">
          <legend>Formato</legend>
          <div className="avatar-concept-lab__options avatar-concept-lab__options--avatars">
            {AVATARS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="avatar-concept-lab__option"
                aria-label={`Escolher avatar ${option.label}`}
                aria-pressed={option.id === avatar}
                data-avatar={option.id}
                title={option.label}
                onClick={() => onAvatarChange(option.id)}
              >
                <PlayerFace color={color} avatar={option.id} skin={skin} size={36} />
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="avatar-concept-lab__picker">
          <legend>Skin</legend>
          <div className="avatar-concept-lab__options avatar-concept-lab__options--skins">
            {SKINS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="avatar-concept-lab__option"
                aria-label={`Escolher skin ${option.label}`}
                aria-pressed={option.id === skin}
                data-skin={option.id}
                title={option.label}
                onClick={() => onSkinChange(option.id)}
              >
                <PlayerFace color={color} avatar={avatar} skin={option.id} size={36} />
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  )
}
