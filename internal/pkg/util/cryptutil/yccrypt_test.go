package cryptutil

import (
	"testing"
)

func TestYcCardEncrypt(t *testing.T) {
	type args struct {
		card string
	}
	tests := []struct {
		name    string
		args    args
		want    string
		wantErr bool
	}{
		{
			name: "test1",
			args: args{
				card: "110101201408117834",
			},
			want:    "654c444b756d4c364e5743354c6b64774153746971512b6e546a646b7a3947424a474e6d49344e456132553767",
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := YcCardEncrypt(tt.args.card)
			if (err != nil) != tt.wantErr {
				t.Errorf("YcCardEncrypt() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("YcCardEncrypt() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestYcCardDecrypt(t *testing.T) {
	type args struct {
		crypt string
	}
	tests := []struct {
		name    string
		args    args
		want    string
		wantErr bool
	}{
		{
			name: "test1",
			args: args{
				crypt: "654c444b756d4c364e5743354c6b64774153746971512b6e546a646b7a3947424a474e6d49344e456132553767",
			},
			want: "110101201408117834",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := YcCardDecrypt(tt.args.crypt)
			if (err != nil) != tt.wantErr {
				t.Errorf("YcCardDecrypt() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("YcCardDecrypt() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestYcPhoneEncrypt(t *testing.T) {
	type args struct {
		phone string
	}
	tests := []struct {
		name    string
		args    args
		want    string
		wantErr bool
	}{
		{
			name: "test1",
			args: args{
				phone: "13800138000",
			},
			want:    "737876584775575f416e4d7450574f71366c4a5979772b762d422d7669503062346578725149466e35466244672b587674536d33637a794777364a584f58417244716677",
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := YcPhoneEncrypt(tt.args.phone)
			if (err != nil) != tt.wantErr {
				t.Errorf("YcPhoneEncrypt() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("YcPhoneEncrypt() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestYcPhoneDecrypt(t *testing.T) {
	type args struct {
		crypt string
	}
	tests := []struct {
		name    string
		args    args
		want    string
		wantErr bool
	}{
		{
			name: "test1",
			args: args{
				crypt: "737876584775575f416e4d7450574f71366c4a5979772b762d422d7669503062346578725149466e35466244672b587674536d33637a794777364a584f58417244716677",
			},
			want:    "13800138000",
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := YcPhoneDecrypt(tt.args.crypt)
			if (err != nil) != tt.wantErr {
				t.Errorf("YcPhoneDecrypt() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("YcPhoneDecrypt() = %v, want %v", got, tt.want)
			}
		})
	}
}
